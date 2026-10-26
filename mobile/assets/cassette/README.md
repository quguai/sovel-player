# Smoke cassette assets

Generated with the built-in image_gen tool, 2026-10-26. These original materials are shared by the web DEMO and React Native cassette player. They are not photographs of an actual product.

- `noir-shell-v2.png`: transparent shell, 1564 × 1006. Two empty wells at approximately (450, 460) and (1106, 460). Display at 420 × 270. Wound tape sits behind the shell; a local mask reveals it through the smoked casing.
- `noir-hub-v2.png`: separate transparent brass hub, used twice. Only the hub and tape winding layers rotate; the shell, reflections and labels stay still. Playback pauses the animations without resetting their phase. Reduced motion disables them.

The track labels remain live UI. Tape-pack radius follows the square root of accumulated tape area. The player simulates winding, rather than modelling cassette transport mechanics exactly.

## Shell prompt

Use case: product-mockup. Create a photorealistic isolated cassette tape asset for an interactive music player UI. A premium compact audio cassette viewed perfectly straight-on, orthographic front face, NO perspective tilt. Wide 420:270 proportional silhouette. Smoked translucent charcoal polycarbonate shell, warm champagne-gold precision screws and fine metal edges, visible layered interior, realistically fine moulded ribs, hairline scratches and soft studio specular reflections, bevelled transparent edges. Strong believable depth from internal shadows, no bokeh on main object. A dark blank slim label strip along the top 18% of housing (no lettering at all). TWO EMPTY CLEAR CIRCULAR REEL WELLS centred at 27% and 73% of width and 53% of height, each diameter 33% of object width, neutral dark interior, NO REELS OR HUBS OR SPOKES in those wells: these will be animated by code later. Visible thin dark brown tape threading across bottom rollers and lower tape guide mechanism. Small brass rollers at bottom, tiny physical screw heads in corners, realistic bottom trapezoid with moulded grooves and metal contacts. Gold is subtle brushed brass, black dominates. Ultra detailed premium physical object, not an icon, not vector art, not a flat diagram. Object fills almost entire canvas with small even transparent margins, background genuinely transparent. One single cassette only, no layout, no controls, no text, no watermark.

## Hub prompt

Use case product-mockup. Single isolated photorealistic miniature audio cassette reel hub, exactly circular, front orthographic view, transparent background. Champagne brass precision machined outer ring, six rounded radial spoke cutouts showing darkness, small central hexagonal splined hole, layered smoked translucent plastic flange, fine concentric brushed machining lines, softly reflected studio light. Tiny authentic functional audio cassette spool, not a car wheel, not a vinyl record, not a whole cassette. Physical material texture with warm metallic satin highlights and darker rim thickness. One single circular object centred and filling 92% of square canvas, clean transparent background. No text, no labels, no shadows outside circular silhouette. This hub will rotate in an interactive cassette player, lighting should be subtle and balanced.

## Silver presentation

The current DEMO uses smoke/silver instead of black/gold. Hardware images are desaturated by CSS (`cassette-silver-material`) on the web and an SVG color filter in React Native; source PNGs are preserved and album art is unaffected. Labels, highlights and playback controls use neutral silver tones. The `noir` preference key remains for compatibility with existing saved DEMO choices.

## Distinct designs (v5)

Generated with the built-in image_gen tool on 2026-10-26. Original transparent PNGs bundled here for both players. Each uses its own aperture coordinates in `editions.js`, with separate animated tape and hubs behind the housing.

- `classic-shell-v5.png`: chamfered charcoal ABS housing, red and ivory paper label, narrow horizontal viewing window.
- `studio-shell-v5.png`: brushed aluminium plate, two recessed square apertures, red side insert and machined lower slot.
- `pop-shell-v5.png`: rounded graphic silhouette, large A and PLAY typography, flat navy viewing strip and simplified reel geometry.

The picker now offers the original smoke design and these three distinct housings.
