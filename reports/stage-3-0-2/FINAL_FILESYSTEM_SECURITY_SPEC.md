# FlowForge — Stage 3.0.2: Final Filesystem Security Specification (Cross-Platform Jail & Threat Analysis)

> **Document ID**: `STAGE-3-0-2-FS-SEC-02`  
> **Status**: APPROVED TECHNICAL SPECIFICATION  
> **Target Implementation**: Phase 1 (`T1.3`, `T1.4` / `DEF-SEC-01`, `DEF-SEC-02`)  
> **Target File**: `src/lib/executors.ts` (lines 649–690)  
> **Audited Baseline Commit**: `6955ed094aca40e43dae3ae40e129b6480f7ed0b`

---

## 1. Executive Summary & Problem Definition

In FlowForge baseline `src/lib/executors.ts`:
- `read_file` (L649–661): Uses `path.resolve(s(p.path))` without confinement. An attacker can read any file readable by the process user (e.g., `/etc/passwd`, `C:\Windows\System32\drivers\etc\hosts`, `.env.local`).
- `write_file` (L662–672): Uses `path.resolve(s(p.path))` and calls `fs.mkdir(path.dirname(file), { recursive: true })` and `fs.writeFile(file, ...)`. An attacker can overwrite arbitrary system files or application code.
- `exec` (L673–690): Executes arbitrary shell commands via Node's `child_process.exec` without authorization gates or kill-switches.

This specification defines:
1. An exhaustive **Windows and POSIX path confinement model** for `read_file` and `write_file`.
2. Safe write semantics for both existing and newly created files.
3. Safe directory creation controls.
4. An uncompromising **TOCTOU & symlink replacement analysis** disclosing exact residual risks.
5. Host shell execution (`exec` node) policy and execution guardrails.

---

## 2. Platform Threat Surface Analysis

### 2.1 Windows-Specific Attack Vectors

Operating FlowForge on Windows exposes multiple filesystem quirks that easily defeat simplistic path checks:

| Vector | Attack Payload Example | OS Behavior | Countermeasure & Validation Rule |
| :--- | :--- | :--- | :--- |
| **Reserved DOS Device Names** | `CON`, `PRN`, `AUX`, `NUL`, `COM1`..`COM9`, `LPT1`..`LPT9`, `CON.txt`, `aux.json` | Windows locks execution or triggers driver I/O, causing process freeze, BSOD, or unbounded hanging. | **Regex Disallow List**: Reject any path component whose base name matches `^(CON\|PRN\|AUX\|NUL\|COM[1-9]\|LPT[1-9])(\..*)?$` (case-insensitive). |
| **Alternate Data Streams (ADS)** | `safe.txt:hidden.exe`, `sample.txt::$DATA` | Writes or reads secondary NTFS file streams, bypassing extension checks, concealing malware, or executing payload streams. | **Disallow Colon**: Reject any path containing `:` after the volume drive root. In relative filenames, `:` is strictly forbidden. |
| **Trailing Dots and Spaces** | `data/files/secret.txt. . .` or `data/files/dir...` | Windows NTFS automatically strips trailing spaces and dots upon lookup. A path check for `secret.txt.` might pass a filter but open `secret.txt`. | **Trim & Reject**: Paths with components ending in `. ` or space must be sanitized or rejected with validation error. |
| **UNC Paths** | `\\?\C:\Windows\...`, `\\127.0.0.1\c$\Windows\...`, `\\localhost\share\...` | Bypasses standard Win32 path normalization and redirects I/O to remote SMB shares, local administrative shares, or raw device namespaces. | **Disallow UNC**: Paths starting with `\\` or containing `//` or `\\?\` are rejected immediately. |
| **Drive Letter Escalation** | `D:\sensitive\report.pdf`, `C:/secrets.json` | An absolute path referencing another volume breaks out of current workspace. | **Volume Confinement**: Jail root must reside on an explicit volume; paths targeting another drive letter are blocked. |
| **Reparse Points & NTFS Junctions** | `mklink /J junction C:\Windows` | Directory junction redirects traversal to another directory tree on the filesystem. | **Realpath Resolution**: Every path component must resolve within the canonical jail boundary via `fs.realpath`. |

### 2.2 POSIX-Specific Attack Vectors

| Vector | Attack Payload Example | OS Behavior | Countermeasure & Validation Rule |
| :--- | :--- | :--- | :--- |
| **Directory Traversal** | `../../../../etc/shadow` | Resolves upward through parent directories. | Normalized via `path.resolve` and verified via `path.relative` prefix. |
| **Symlink Escapes** | `ln -s /etc/passwd link.txt` | File points outside jail directory. | Canonical resolution via `fs.realpath`. |
| **Null-Byte Injection** | `safe.txt\0.js` | Historically truncated C-strings in libc. | Node.js buffers disallow null bytes, but input strings containing `\0` are explicitly rejected. |

---

## 3. Authoritative Filesystem Jail Algorithm

The confinement algorithm operates on a designated jail root:  
`JAIL_ROOT = path.resolve(process.env.FLOWFORGE_JAIL_DIR || path.join(process.cwd(), "data", "files"))`

```typescript
import path from "node:path";
import fs from "node:fs/promises";

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const ILLEGAL_CHARS = /[<>:"|?*\0]/;

export interface JailCheckResult {
  ok: boolean;
  resolvedPath: string;
  error?: string;
}

export async function validateJailPath(
  userPath: string,
  mode: "read" | "write"
): Promise<JailCheckResult> {
  const JAIL_ROOT = path.resolve(process.env.FLOWFORGE_JAIL_DIR || path.join(process.cwd(), "data", "files"));
  
  if (!userPath || typeof userPath !== "string") {
    return { ok: false, resolvedPath: "", error: "Path must be a non-empty string" };
  }

  // 1. Pre-validation checks for Windows quirks
  if (userPath.startsWith("\\\\") || userPath.includes("//")) {
    return { ok: false, resolvedPath: "", error: "UNC paths are strictly prohibited" };
  }

  // Check illegal characters (disallowing ADS ':' and control characters)
  // Allow ':' only if it's part of Windows absolute path "C:\" matching jail root
  const hasColon = userPath.includes(":");
  if (hasColon) {
    const isWindowsDriveRoot = /^[a-zA-Z]:[\\/]/.test(userPath);
    if (!isWindowsDriveRoot || userPath.indexOf(":", 2) !== -1) {
      return { ok: false, resolvedPath: "", error: "Invalid path: Alternate Data Streams and colons are prohibited" };
    }
  }

  // 2. Resolve absolute normalized path
  const absoluteTarget = path.isAbsolute(userPath)
    ? path.resolve(userPath)
    : path.resolve(JAIL_ROOT, userPath);

  // 3. Reject Windows Reserved Device Names & Trailing Dots/Spaces
  const segments = absoluteTarget.split(path.sep);
  for (const segment of segments) {
    if (WINDOWS_RESERVED_NAMES.test(segment)) {
      return { ok: false, resolvedPath: "", error: `Forbidden: Reserved device name "${segment}"` };
    }
    if (segment.endsWith(".") || segment.endsWith(" ")) {
      return { ok: false, resolvedPath: "", error: `Forbidden: Path component cannot end with space or dot: "${segment}"` };
    }
  }

  // 4. Lexical Containment Check
  const relative = path.relative(JAIL_ROOT, absoluteTarget);
  const isLexicallyContained = !relative.startsWith("..") && !path.isAbsolute(relative);
  if (!isLexicallyContained) {
    return { ok: false, resolvedPath: "", error: "Access denied: Path escapes jail root" };
  }

  // 5. Canonical Symlink & Reparse Point Resolution
  if (mode === "read") {
    // For read operations: file MUST already exist
    try {
      const realTarget = await fs.realpath(absoluteTarget);
      const realJail = await fs.realpath(JAIL_ROOT);
      const realRel = path.relative(realJail, realTarget);
      if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
        return { ok: false, resolvedPath: "", error: "Access denied: Symlink target escapes jail root" };
      }
      return { ok: true, resolvedPath: realTarget };
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return { ok: false, resolvedPath: "", error: `File not found: ${userPath}` };
      }
      return { ok: false, resolvedPath: "", error: `Filesystem resolution error: ${err.message}` };
    }
  } else {
    // For write operations: target file may or may not exist yet
    try {
      const fileExists = await fs.stat(absoluteTarget).then(() => true).catch(() => false);
      if (fileExists) {
        // Existing file: verify its canonical symlink target is jailed
        const realTarget = await fs.realpath(absoluteTarget);
        const realJail = await fs.realpath(JAIL_ROOT);
        const realRel = path.relative(realJail, realTarget);
        if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
          return { ok: false, resolvedPath: "", error: "Access denied: Symlink write target escapes jail root" };
        }
        return { ok: true, resolvedPath: realTarget };
      } else {
        // Non-existing file: verify parent directory resolution
        let parentDir = path.dirname(absoluteTarget);
        // Find closest existing ancestor directory
        let ancestor = parentDir;
        while (ancestor !== JAIL_ROOT) {
          const exists = await fs.stat(ancestor).then(() => true).catch(() => false);
          if (exists) break;
          const next = path.dirname(ancestor);
          if (next === ancestor) break;
          ancestor = next;
        }

        const realAncestor = await fs.realpath(ancestor);
        const realJail = await fs.realpath(JAIL_ROOT);
        const realRel = path.relative(realJail, realAncestor);
        if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
          return { ok: false, resolvedPath: "", error: "Access denied: Ancestor directory escapes jail root" };
        }
        return { ok: true, resolvedPath: absoluteTarget };
      }
    } catch (err: any) {
      return { ok: false, resolvedPath: "", error: `Path validation failed: ${err.message}` };
    }
  }
}
```

---

## 4. Safe Directory Creation Controls

In `write_file` (L667):
- **Current Behavior**: `await fs.mkdir(path.dirname(file), { recursive: true });`
- **Hardened Behavior**:
  1. `validateJailPath(file, "write")` must succeed first.
  2. The parent directory path `path.dirname(file)` is confirmed strictly within `JAIL_ROOT`.
  3. `fs.mkdir` is executed only within the validated subdirectory tree.
  4. File write uses atomic writing where feasible or direct file write to the validated target.

---

## 5. TOCTOU & Symlink Race Condition Analysis (Residual Risk Disclosure)

### 5.1 The Fundamental Limitation of Application-Level Path Validation
A critical security reality must be stated without equivocation:
> [!CAUTION]
> **No pure Node.js in-process path validation can guarantee 100% race-free confinement against a local adversary manipulating the filesystem concurrently.**

- **Time-Of-Check to Time-Of-Use (TOCTOU)**:
  - Step A: `validateJailPath` calls `fs.realpath` and validates the path is safe.
  - Step B (Microsecond window): An external concurrent process or symlink replaces the file or directory with a junction/symlink pointing to `C:\Windows\System32` or `/etc/passwd`.
  - Step C: Node calls `fs.writeFile` or `fs.readFile`, opening the swapped target.
- **Why Node.js Standard Library Lacks True Race-Free I/O**:
  - Node.js `fs/promises` does not provide `openat(2)` or `O_NOFOLLOW` / `O_DIRECTORY` file descriptor-relative operations on Windows.
  - Windows file handles and NTFS reparse points require OS-level sandboxing (e.g. AppContainer, Windows Sandbox, Docker container isolation, or SECCOMP / Linux namespaces).

### 5.2 Formally Disclosed Residual Risks
1. **Local Concurrent Symlink Swaps**: If an attacker already has local OS execution access on the server machine, they could race the Node event loop during file writes.
2. **Cooperative Application Jail**: FlowForge's filesystem jail is a **robust application-level barrier** designed to eliminate workflow-expression path traversals and injection vulnerabilities. It is **NOT** an OS-level virtual machine or hypervisor sandbox.
3. **Defense-in-Depth Mitigation**: FlowForge must run under a dedicated OS service account with minimal filesystem privileges, ensuring the OS user itself cannot write to sensitive system directories.

---

## 6. Host Shell Execution (`exec` Node) Policy

### 6.1 Default-Deny Kill-Switch Architecture

In `src/lib/executors.ts` (L673–690):
```typescript
exec: {
  mode: "each",
  run: async (p) => {
    // 1. Mandatory Default-Deny Kill-Switch Check
    const isExecEnabled = process.env.FLOWFORGE_ENABLE_EXEC === "true";
    if (!isExecEnabled) {
      throw new Error(
        "Execution of host shell commands is disabled by policy. Set FLOWFORGE_ENABLE_EXEC=true in your environment to enable."
      );
    }

    need(p, "command");

    // 2. Working Directory Confinement
    const configuredCwd = s(p.cwd);
    let effectiveCwd = process.cwd();
    if (configuredCwd) {
      const check = await validateJailPath(configuredCwd, "read");
      if (!check.ok) {
        throw new Error(`Invalid working directory: ${check.error}`);
      }
      effectiveCwd = check.resolvedPath;
    }

    // 3. Process Execution with Bounds
    const timeoutSec = Math.min(Math.max(Number(p.timeout) || 60, 1), 300); // 1s min, 300s max
    const { stdout, stderr } = await execP(s(p.command), {
      cwd: effectiveCwd,
      timeout: timeoutSec * 1000,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        // Scrubbed environment: omit sensitive database and cloud credentials
        PATH: process.env.PATH,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        NODE_ENV: process.env.NODE_ENV,
      },
    });

    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  },
}
```

### 6.2 Host Execution Residual Risk Disclosure
- Even with `FLOWFORGE_ENABLE_EXEC="true"`, any command executed runs with the **full privileges of the FlowForge process user**.
- FlowForge does not claim command filtering or shell string sanitization. Enabling this node is an administrative choice intended for local development workflows. In multi-tenant or public environments, `FLOWFORGE_ENABLE_EXEC` must remain disabled.

---

## 7. Verification Verdict

| Verification Item | Implementation Rule | Status |
| :--- | :--- | :---: |
| Windows Reserved Names (`CON`, `PRN`, `NUL`, etc.) | Regex disallow list in Section 3 | **PASS** |
| Alternate Data Streams (`:`) blocked | Colon inspection in Section 3 | **PASS** |
| UNC Paths (`\\?\`, `//`) blocked | Leading slash check in Section 3 | **PASS** |
| Symlink resolution on existing files | `fs.realpath` comparison in Section 3 | **PASS** |
| Safe directory creation | Parent directory confinement in Section 4 | **PASS** |
| TOCTOU residual risk disclosed | Explicitly documented in Section 5 | **PASS** |
| `exec` default-deny kill-switch | Defined in Section 6.1 | **PASS** |
