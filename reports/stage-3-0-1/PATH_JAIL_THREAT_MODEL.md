# FlowForge — Stage 3.0.1: Filesystem Path Jail Threat Model & Boundary Specification

> **Scope**: In-depth threat analysis of filesystem access in `read_file` and `write_file` executors, edge-case vulnerability vectors on Windows & POSIX, and boundary validation mechanics.

---

## 1. Threat Matrix & Attack Vectors

| Attack Vector | Malicious Input Example | Naive `.startsWith()` Behavior | Hardened Boundary Behavior | Mitigation Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **1. Parent Directory Traversal** | `../../package.json` | Rejects (if resolved doesn't start with root) | **REJECTED** | `path.relative()` contains `..` or is absolute |
| **2. Prefix Collision** | `../files-secret/passwords.txt` | **VULNERABLE (PASSES)** | **REJECTED** | `path.relative(root, resolved)` resolves to `../files-secret/...` |
| **3. Symlink Destination Escape** | Symlink `safe.txt -> C:\Windows\win.ini` | **VULNERABLE (PASSES)** | **REJECTED** | `fs.realpathSync()` evaluates true disk inode/destination |
| **4. Windows Drive Letter Escape**| `D:\sensitive\data.csv` | Rejects on drive mismatch | **REJECTED** | `path.isAbsolute(path.relative(root, target))` detects cross-drive |
| **5. Windows Reserved Device Name**| `CON`, `NUL.txt`, `COM1` | **VULNERABLE (Process Hangs)** | **REJECTED** | Regex regex filter `^(CON\|PRN\|AUX\|NUL\|COM[1-9]\|LPT[1-9])` |
| **6. UNC Network Path Traversal** | `\\attacker-server\share\file` | Unpredictable behavior | **REJECTED** | Rejects network roots and non-canonical drive letters |
| **7. Null Byte Injection** | `valid.txt\0.exe` | May bypass string filters | **REJECTED** | Pre-validation regex rejects all ASCII control characters |
| **8. Write to Non-Existent Dir** | `newdir/sub/output.txt` | Target doesn't exist yet | **SECURE** | Validates nearest existing ancestor directory realpath |

---

## 2. In-Depth Threat Vector Analyses

### 2.1 The Prefix Collision Attack Vector
When sandboxes use string prefix validation:
```typescript
// INSECURE LOGIC:
const root = "C:\\flowforge\\data\\files";
const target = path.resolve(root, "../files-backup/keys.txt");
// target is "C:\\flowforge\\data\\files-backup\\keys.txt"
if (target.startsWith(root)) {
  // TRUE! Because "C:\flowforge\data\files-backup" starts with "C:\flowforge\data\files"
}
```
An attacker who knows that an adjacent directory begins with the same prefix can escape the sandbox cleanly.

**The Solution**:
Using `path.relative(root, target)`:
```typescript
const rel = path.relative("C:\\flowforge\\data\\files", "C:\\flowforge\\data\\files-backup\\keys.txt");
// rel is "..\\files-backup\\keys.txt"
// rel.startsWith("..") is TRUE -> VIOLATION DETECTED & BLOCKED!
```

---

### 2.2 The Symlink Escape Vector
If a user creates a symbolic link or directory junction inside `data/files`:
```
data/files/junction -> C:\Users\srira\Documents
```
Reading `data/files/junction/secret.pdf`:
- `path.resolve("data/files", "junction/secret.pdf")` returns `C:\flowforge\data\files\junction\secret.pdf`.
- A naive check believes this path is inside `data/files`.
- But opening the file reads from `C:\Users\srira\Documents\secret.pdf`.

**The Solution**:
Invoke `fs.realpathSync(resolvedPath)` to resolve all symlinks to their physical disk location and assert that the *canonical target* remains inside the *canonical jail root*.

---

### 2.3 Windows Reserved Device Denial-of-Service
On Windows NT systems, file names matching `CON`, `PRN`, `AUX`, `NUL`, `COM1` through `COM9`, and `LPT1` through `LPT9` (regardless of extension) are treated as legacy hardware device handles.
Attempting to read or write to `data/files/CON.txt` or `data/files/NUL` can block the Node.js thread indefinitely or cause unhandled filesystem driver exceptions.

**The Solution**:
Explicit regex rejection prior to filesystem operations:
```typescript
const baseName = path.basename(resolvedPath).toUpperCase();
if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i.test(baseName)) {
  throw new Error(`Access Denied: Windows reserved device name "${baseName}"`);
}
```

---

## 3. Production Jail Implementation & Test Coverage

The hardened `safeJailPath()` helper will be placed in `src/lib/executors.ts` as an exported helper:
```typescript
export function safeJailPath(userPath: string): string
```
Both `read_file` and `write_file` will route through this function before executing any `fs.readFile` or `fs.writeFile`.
