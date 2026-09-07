# Research Platform V2

Forming Material is evolving from a simple experiment archive into a collaborative fabrication research platform. The data model connects experimental evidence, historical and technical sources, materials, purchasable products, vendors, equipment, and Atlas entries.

## Core Structure

Experiments are the authored research records. They document objectives, hypotheses, sheet geometry, forming methods, undercut measurements, stage protocols, outcomes, conclusions, and the next test.

Research Sources are precedents and references: papers, patents, manuals, historical objects, supplier pages, images, videos, and other evidence that inform the work.

The Atlas organizes knowledge into public categories and entries, such as forming methods, materials, tool systems, geometric operations, observed behaviors, and research sources.

Materials describe scientific or fabrication material identities: Aluminum 3003, copper sheet, TPU, PLA, paper, cardstock, polyurethane rubber, and similar classes.

Products describe purchasable commercial instances of materials: a specific sheet, filament, rubber, insert, or lab supply with SKU, dimensions, price, inventory, and reorder information.

Vendors are suppliers or manufacturers that provide products. Vendor contact and purchasing details are treated as authenticated lab information, not public content.

Purchases preserve lab memory: purchase date, quantity, price, order reference, notes, and purchaser.

Equipment describes fabrication and measurement hardware: presses, printers, scanners, cutters, heating tools, and measuring devices.

## Material, Product, Vendor, Equipment

Material = scientific/material identity. It describes what the thing is and how it behaves.

Product = purchasable commercial instance. It describes exactly what was bought or can be reordered.

Vendor = supplier. It describes where the product came from and how the lab can reorder it.

Equipment = fabrication or measurement hardware. It describes the tools used to make, form, scan, heat, or measure experiments.

This distinction lets an experiment point to both the research material and the exact product that was used.

## Research Lineage

The research logic is:

Precedent -> Principle -> Translation -> Experiment -> Next Test

A precedent provides evidence or context. A principle extracts what matters. Translation adapts that principle into a tool, material setup, or press operation. The experiment tests the translation. The next test preserves continuity for future work.

The database supports this through junction tables rather than a single rigid lineage table, so experiments, sources, materials, Atlas entries, and equipment can be linked in multiple ways.

## Editorial Workflow

Canonical research content follows:

Draft -> Submitted -> Reviewed -> Published -> Archived

Students and research assistants can contribute draft or submitted records they authored. Administrators review, publish, archive, and manage canonical records. Public users only see published content.

The schema keeps `is_published` in this version for compatibility with existing UI and RLS patterns. Later migrations can simplify public visibility once the application fully moves to status-driven workflows.
