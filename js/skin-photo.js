// Arco Solar — skin tone from photo
// Everything here runs ON-DEVICE: the photo is read into a <canvas>, pixel
// data never leaves the browser, and no image is uploaded anywhere. This
// only SUGGESTS a skin type using the ITA (Individual Typology Angle), a
// real dermatological measure — it's an estimate to confirm, never applied
// automatically.
(function(global){

  // --- sRGB (0-255) -> CIE L*a*b*, then ITA angle ---
  function srgbToLinear(c){
    c = c/255;
    return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
  }
  function rgbToXYZ(r,g,b){
    const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    // sRGB D65 matrix
    return {
      x: R*0.4124564 + G*0.3575761 + B*0.1804375,
      y: R*0.2126729 + G*0.7151522 + B*0.0721750,
      z: R*0.0193339 + G*0.1191920 + B*0.9503041,
    };
  }
  function xyzToLab(x,y,z){
    // D65 reference white
    const Xn=0.95047, Yn=1.0, Zn=1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);
    const fx = f(x/Xn), fy = f(y/Yn), fz = f(z/Zn);
    return {
      L: 116*fy - 16,
      a: 500*(fx-fy),
      b: 200*(fy-fz),
    };
  }
  function rgbToLab(r,g,b){
    const xyz = rgbToXYZ(r,g,b);
    return xyzToLab(xyz.x, xyz.y, xyz.z);
  }

  // ITA° = arctan((L*-50)/b*) × (180/π) — standard dermatological formula
  function computeITA(L, b){
    return Math.atan2((L-50), b) * (180/Math.PI);
  }

  // Published ITA -> skin-type buckets (Chardon et al. convention),
  // mapped onto our Fitzpatrick-style 1-6 scale.
  function classifyITA(itaDeg){
    if(itaDeg > 55) return 1;
    if(itaDeg > 41) return 2;
    if(itaDeg > 28) return 3;
    if(itaDeg > 10) return 4;
    if(itaDeg > -30) return 5;
    return 6;
  }

  // Averages a central box of a generic {data, width, height} pixel buffer
  // (works with real ImageData or a synthetic test double), trimming very
  // bright/dark outlier pixels (specular highlights, shadows, background).
  function averageCentralRegion({ data, width, height }){
    const boxW = Math.floor(width*0.4), boxH = Math.floor(height*0.4);
    const x0 = Math.floor((width-boxW)/2), y0 = Math.floor((height-boxH)/2);
    let rs=[], gs=[], bs=[];
    for(let y=y0; y<y0+boxH; y++){
      for(let x=x0; x<x0+boxW; x++){
        const i = (y*width + x) * 4;
        const r=data[i], g=data[i+1], b=data[i+2];
        const lum = 0.299*r + 0.587*g + 0.114*b;
        if(lum < 25 || lum > 235) continue; // drop near-black/near-white outliers
        rs.push(r); gs.push(g); bs.push(b);
      }
    }
    if(rs.length === 0) return { r:128, g:128, b:128 };
    const avg = arr => arr.reduce((a,v)=>a+v,0)/arr.length;
    return { r: avg(rs), g: avg(gs), b: avg(bs) };
  }

  function analyzePixels(pixelBuffer){
    const { r, g, b } = averageCentralRegion(pixelBuffer);
    const lab = rgbToLab(r,g,b);
    const itaDeg = computeITA(lab.L, lab.b);
    return { ita: itaDeg, suggestedId: classifyITA(itaDeg), sampledColor: `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})` };
  }

  // Browser-only: reads a File (from <input type=file capture>), draws it to
  // an offscreen canvas, and analyzes it. Never uploads anything.
  function analyzeImageFile(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try{
          const canvas = document.createElement('canvas');
          const size = 120;
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          // cover-fit crop into the square canvas
          const scale = Math.max(size/img.width, size/img.height);
          const dw = img.width*scale, dh = img.height*scale;
          ctx.drawImage(img, (size-dw)/2, (size-dh)/2, dw, dh);
          const imageData = ctx.getImageData(0,0,size,size);
          URL.revokeObjectURL(url);
          resolve(analyzePixels(imageData));
        }catch(e){ reject(e); }
      };
      img.onerror = () => reject(new Error('image-load-failed'));
      img.src = url;
    });
  }

  global.SkinPhoto = { analyzePixels, analyzeImageFile, computeITA, classifyITA, rgbToLab, averageCentralRegion };
})(window);
