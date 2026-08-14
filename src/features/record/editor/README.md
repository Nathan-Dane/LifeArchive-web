# Record Markdown editor dependency decision

The Record surface uses Pell only as a small contenteditable command adapter.
The shared dependency-free LifeArchive Markdown codec owns all semantics,
allowlist reconstruction, and Markdown encoding. `bodyMarkdown` remains the
only durable writing representation; editor DOM is installed once when a
destination opens and observed without rebuilding it during normal input.

The editor is lazy-loaded, uses the application's existing tokens and toolbar,
and has no raw-Markdown mode. Pell's visual CSS and unsupported actions are not
included.

The development mock keeps one immediate Markdown buffer per exact Record
destination. It does not claim that the buffer is saved or durable.
