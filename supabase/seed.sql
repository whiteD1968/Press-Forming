-- Optional starter research-source records taken from the working Miro research map.
-- Add URLs/citations after confirming each source.
insert into public.research_sources (title, source_type, principle, research_translation, notes)
values
  ('Metal Forming With a 3D Printer', 'precedent', '3D-printed tooling can substitute for conventional forming tools at experimental scale.', 'Use printed rigid tools to establish a repeatable pre-form before compliant stages.', 'Working-board reference; verify citation and URL before publication.'),
  ('How to Do Rapid Tooling for Sheet Metal Forming', 'precedent', 'Rapid tooling lowers the threshold for iterative forming tests.', 'Iterate tool geometry quickly and record each tool revision with the experiment lineage.', 'Working-board reference; verify citation and URL before publication.'),
  ('3D Printed Press Brake Forming Tools', 'precedent', 'Printed tools can withstand useful localized forming loads when geometry and load path are controlled.', 'Use rigid printed tools for bends and initial geometry before undercut-forming stages.', 'Working-board reference; verify citation and URL before publication.');
