Guidelines for writing good code for a developer

Choose clean code over clever code.
Write object oriented code as much as possible.
Keep function sizes small, ideally 10 lines.
Try and keep files between 100 and 300 lines.
Don't keep too many files in a folder or module. Try and keep it under 15.
Avoid abbreviations.
Use standard API as much as possible.
Reuse. Write as little code as possible.
Use Frappe UI, espresso design system for UI styling.
Always write tests, and make sure they work.
Build the minimum working app, then iterate towards your goals.

React Guidelines

Keep components clean and pure. UI only components should do just that.
Abstract away common logic to reusable hooks
Good variable names are the best way to document your code
Use JSDocs to document code - do not add verbose documentation. Brevity is preferred.

Always ensure that semgrep rules for frappe (frappe/semgrep-rules) pass.
Do not add explicit database commits.
Do not ignore permission checks in database calls