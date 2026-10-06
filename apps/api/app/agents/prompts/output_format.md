# OUTPUT FORMAT

Write every file in full, one after another, exactly like this:

<<<FILE path/of/the/file>>>
the complete file contents
<<<END>>>

After the files you may add ONE notes block for the rest of the team: at most 6 short bullet lines with
decisions other agents must follow, known limitations, and, for a fix, the root cause and what you changed.

<<<NOTES>>>
- ...
<<<END>>>

Rules
- Always the complete file, never a partial snippet, a diff or "rest unchanged".
- No explanations, no markdown code fences, nothing outside these blocks.

Example of good notes
- "Order totals are computed on the server from product prices; the frontend only sends product ids and quantities."
- "Fixed: POST /api/contact accepted an empty message because nothing validated it; it now answers 422."
