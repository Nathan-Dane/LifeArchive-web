# Record Markdown editor dependency decision

Step 36 uses Lexical as an always-visual writing surface. The live editor state
is authoritative while the surface is open; Markdown is imported when a
destination opens and exported after visual changes for the existing
`LifeArchiveClient` buffer boundary. Markdown spelling and insignificant
whitespace may be normalised, but headings, emphasis, lists, quotes, links, and
the visible writing must survive reopening.

Only the Lexical packages needed for those controls are included. The editor is
lazy-loaded with the Record writing surface, uses the application's existing
tokens and toolbar, and has no raw-Markdown mode.

The development mock keeps one immediate Markdown buffer per exact Record
destination. It does not claim that the buffer is saved or durable.
