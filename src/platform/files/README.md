# Archive file handoff

Web v0.1 selects and downloads one opaque `*.lifearchive.tar` file with MIME
type `application/x-tar`. The TAR contains exactly one unchanged canonical
`.lifearchive` directory. The compiled runtime owns wrapping, path validation,
archive verification, staging, cancellation, and application.

`archiveTransfer.ts` is deliberately mechanical:

- import validates only the outer filename, permissive picker MIME, and
  non-empty size, then passes the browser-backed `File` and its stream toward
  the worker;
- export accepts a runtime-produced `File`, prepares its object URL and exact
  download metadata, and requires the caller to release that URL; and
- it never calls `arrayBuffer()`, parses TAR or archive files, enumerates
  records, constructs internal paths, or keeps a second complete package.

The runtime integration and import/export screens are later steps. Errors here
are stable nonlocalized values; visible failure copy belongs to the owning
localized feature.
