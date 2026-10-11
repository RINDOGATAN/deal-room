# Customer logos: sources

All files are single-colour (black ink, transparent knockouts) so the page can tint them with a CSS
filter in light and dark mode. Every SVG was rebuilt from the source paths only (no scripts, no
external references, no metadata, no styles, no embedded images) and optimised with svgo 3.3.2.
Retrieved 11 October 2026.

| File | Format | Source | Treatment |
|---|---|---|---|
| toyota.svg | SVG | Official site header: https://delivery.tcom.assetscs.toyota.com/adobe/assets/urn:aaid:aem:caee6520-2e75-4408-b632-247c747a3e53/as/VIS_toyota_logo_horiz_black_RGB_2023.svg (served on https://www.toyota.com/) | Red square removed; emblem and wordmark kept as one colour |
| bbva.svg | SVG | Wikimedia Commons, File:BBVA_2019.svg, author and credit the company (https://www.bbva.com/), current 2019 mark: https://upload.wikimedia.org/wikipedia/commons/0/05/BBVA_2019.svg | Illustrator metadata, DOCTYPE and entities removed |
| ing.svg | SVG | Official site header: https://www.ing.com/webfiles/1788951119972/images/ing-logo.svg | Recoloured to one colour |
| vodafone.svg | SVG | Wikimedia Commons, File:Vodafone_logo_2017.svg, author "Vodafone Group", credit https://www.vodafone.com/ (speech mark plus wordmark): https://upload.wikimedia.org/wikipedia/commons/5/5f/Vodafone_logo_2017.svg | Style block removed, one colour. The official site only serves the speech mark alone (logo-dark.svg), without the wordmark |
| mapfre.svg | SVG | Official site menu: https://www.mapfre.com/contents/ui/theme/resources/images/menu-logo-transparent.svg | White version recoloured |
| whole-foods.svg | SVG | Inline header SVG on the official site https://www.wholefoodsmarket.com/ (horizontal wordmark) | Extracted the single path; mask and xlink removed |
| sealmetrics.svg | SVG | Official site: https://sealmetrics.com/logos/logo-sealmetrics.svg | Nested SVGs flattened into transforms; one colour |
| clientify.png | PNG 528 x 128, 3.2 KB | Official site: https://clientify.com/wp-content/uploads/2024/08/clientify-logo.png | Unchanged. No SVG is published (the graphic resources page https://clientify.com/en/graphic-resources offers no vector file) |
| conductrics.svg | SVG | Official site: https://www.conductrics.com/wp-content/themes/conductrics-2026/assets/images/conductrics-wordmark.svg | Coloured icon converted to a one-colour silhouette through an internal mask; translucent overlays dropped |
| trackingplan.svg | SVG | Inline header wordmark on the official site https://www.trackingplan.com/ | xmlns added; currentColor replaced by black |

Display sizes (width x height in CSS pixels, optically balanced: equal visual area, wide wordmarks
shorter, compact marks taller): see `manifest.json`.
