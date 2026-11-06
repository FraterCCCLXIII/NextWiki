# Vendored third-party files

## three.js 0.160.0

- Source: https://unpkg.com/three@0.160.0/ (files fetched with curl, same relative paths)
- Version: three.js r160 (`REVISION = '160'`)
- Licence: MIT. The header of `build/three.module.js` reads "Copyright 2010-2023 Three.js Authors, SPDX-License-Identifier: MIT".
- Location: `static/vendor/three-0.160.0/`
- Files: `build/three.module.js` and the examples/jsm addons that static pages import (OrbitControls, RoomEnvironment, GLTFExporter, GLTFLoader, meshopt_decoder, Sky, Water, BokehPass, EffectComposer, MaskPass, OutputPass, Pass, RenderPass, ShaderPass, UnrealBloomPass, the shaders they import, BufferGeometryUtils, TextureUtils).
- Pages use these through an import map: `"three"` maps to `./vendor/three-0.160.0/build/three.module.js` and `"three/addons/"` maps to `./vendor/three-0.160.0/examples/jsm/` (`../vendor/...` from `flight/index.html`).
- Integrity: SRI hashes are SHA-384 of each file as downloaded (base64, `sha384-...`). The pages load these through an import map, which does not take `integrity` attributes, so the hashes are recorded here for audit.

| File | SHA-384 |
| --- | --- |
| `build/three.module.js` | sha384-61S/Nu32S3E5+n+KpCOTb2eRYps6fVKm+9Gz1QBvSePFthb46f063Aa/qe/lykFZ |
| `examples/jsm/controls/OrbitControls.js` | sha384-qlO/ZugKPxAQUAvTlQoo0QECzxJIJySZmCF/DHdb2Xn/hHndFwX/vfUAC9Hbk6LP |
| `examples/jsm/environments/RoomEnvironment.js` | sha384-ZGqh+dJjt6z9NHsWYYt+TPDFj8y+2If7naI6a6AkkyNZyH51CVS3HTWFh0njp4k6 |
| `examples/jsm/exporters/GLTFExporter.js` | sha384-+9EXeA3QCWZZAs5mVgcIc9Jas6GG02zkZCLLL1VZGGLl+/8OEgeCIR44lgyZwK0J |
| `examples/jsm/libs/meshopt_decoder.module.js` | sha384-zhZjnxc+3j2IeX2itXt+5CnnC0YleVRvu5EOaj733tRp38E9hBPnZjweEWX2kN7y |
| `examples/jsm/loaders/GLTFLoader.js` | sha384-oxY9vSeh7Mrt5WmhN8xfWoDRnmoW9krEiRBY7vJKaK90jMUidM0fhbUwcblpBgTu |
| `examples/jsm/objects/Sky.js` | sha384-wuDrkXs4/6ZP+utdQQ7XggxDVg1Lt50OuvF4p/Ac5chibUcyJqnBdJqACclm1Hea |
| `examples/jsm/objects/Water.js` | sha384-b2DK7E3v9WMsIsU4WKc6WEAO/EAEvFSOt75ibrQByZCGSlLFJPtsWHp5xFhvXkT+ |
| `examples/jsm/postprocessing/BokehPass.js` | sha384-Nn0RmEiaTdiSqQqjBV9MhML63mrtaDotlDUJMGkkHWxwYdFzCq2BjhgsUWshL5jJ |
| `examples/jsm/postprocessing/EffectComposer.js` | sha384-L+Ns9skCAqjab7aG8LH5VLknBCoENW7p37sOj39jnITwlWZFabWc29JwzgYf6ygy |
| `examples/jsm/postprocessing/MaskPass.js` | sha384-SDM80tiGflO8UDV/QzR/mASjcc/+wF7KfRVFNHJUIPcTctwoPI8GoWVTlccZw7V4 |
| `examples/jsm/postprocessing/OutputPass.js` | sha384-RJJc+pg+Ue2ZwXlf8n78cPHMiHrqfr+AxxabF5vkXMXjNPF6nSUoqb20IQXkMo6c |
| `examples/jsm/postprocessing/Pass.js` | sha384-gSqIFh8vMmp1veyOysIS3KPVUl/A5JPefYvW4b89OeYeW0bwkrjN7qcC1h0XJK/K |
| `examples/jsm/postprocessing/RenderPass.js` | sha384-LwKrkOBAkmQ2KT4cv6P6q9Rb9L01GIFU34Zp16tGWZoBnrVuujfjpYZb7OxEMb0J |
| `examples/jsm/postprocessing/ShaderPass.js` | sha384-zetU6HhR/vTtgSvnS9DE+GQPZhVT/ZOSLa/1+DSM6rkM9hvBgQWr9bCEosZt93ch |
| `examples/jsm/postprocessing/UnrealBloomPass.js` | sha384-R734/7SvtqjjeteDKG4qcQA0adDCZ1ZcKfYUZsbVr9qqHGlgSXH9eNN4b3NIgwuc |
| `examples/jsm/shaders/BokehShader.js` | sha384-As1skKWkcI7eWCAisg4AV2nHjz8zH2ma2ZuJs2yTyhM5Wg8wq6WMgvAUhp/8GPn8 |
| `examples/jsm/shaders/CopyShader.js` | sha384-kzVlcj2amFaRNIWZ5zE0PmIN+QTNWWvrgKk31S8N/7w0nf7Qq3xqxHRLbD2UPPSl |
| `examples/jsm/shaders/LuminosityHighPassShader.js` | sha384-621kiA/kIdX8rtH6VU6+SwMVx+B8g7MQ6x0fei5dZVX3CQZSLkpOlglIk9sxE+/g |
| `examples/jsm/shaders/OutputShader.js` | sha384-fT4woAJJtXcAxElHG1cGfIZkiSxaj7u+24LHlfNVDZZ9aSjZvr2emMGPmcD9eF0V |
| `examples/jsm/utils/BufferGeometryUtils.js` | sha384-jHGXS4+FuVOBnZkNme2ury3Ccg5DWDLYK22xX/WGdZCZsjRM4J+3n6Qc4CXx1Hjf |
| `examples/jsm/utils/TextureUtils.js` | sha384-40/u8P8J3Ow8H4TDPNg70OS3SxRjKMCskakuBKbkhfuHifPCzytpkQLT2W7FyGpH |

Not vendored: micro-ascent (its own r170 copy, separate task).
