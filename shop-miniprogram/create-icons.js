/**
 * 生成简单的 tabBar 图标
 * 运行: node create-icons.js
 */
const fs = require('fs');
const path = require('path');

// 简单的 1x1 像素 PNG (灰色) - 可以作为占位图标
// 这是最小的有效 PNG 图片
const createSimplePNG = (r, g, b) => {
  // PNG 文件头
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk (13 bytes)
  const width = 81;
  const height = 81;
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);   // width
  ihdrData.writeUInt32BE(height, 4);   // height
  ihdrData.writeUInt8(8, 8);           // bit depth
  ihdrData.writeUInt8(2, 9);          // color type (RGB)
  ihdrData.writeUInt8(0, 10);         // compression
  ihdrData.writeUInt8(0, 11);         // filter
  ihdrData.writeUInt8(0, 12);         // interlace
  
  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdrChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    ihdrData,
    ihdrCrc
  ]);
  
  // IDAT chunk - 简单的未压缩图像数据
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      rawData.push(r, g, b);
    }
  }
  
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  const idatLength = Buffer.alloc(4);
  idatLength.writeUInt32BE(compressed.length, 0);
  const idatChunk = Buffer.concat([
    idatLength,
    Buffer.from('IDAT'),
    compressed,
    idatCrc
  ]);
  
  // IEND chunk
  const iendCrc = crc32(Buffer.from('IEND'));
  const iendChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('IEND'),
    iendCrc
  ]);
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
};

// CRC32 计算
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  crc = crc ^ 0xFFFFFFFF;
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(crc >>> 0, 0);
  return buf;
}

// 颜色定义
const colors = {
  normal: { r: 153, g: 153, b: 153 },    // #999999 - 灰色
  active: { r: 255, g: 107, b: 53 }      // #FF6B35 - 橙色
};

// 创建图标
const icons = [
  { name: 'tab-home', color: 'normal' },
  { name: 'tab-home-active', color: 'active' },
  { name: 'tab-category', color: 'normal' },
  { name: 'tab-category-active', color: 'active' },
  { name: 'tab-cart', color: 'normal' },
  { name: 'tab-cart-active', color: 'active' },
  { name: 'tab-profile', color: 'normal' },
  { name: 'tab-profile-active', color: 'active' },
];

const outputDir = path.join(__dirname, 'images');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

icons.forEach(icon => {
  const png = createSimplePNG(colors[icon.color].r, colors[icon.color].g, colors[icon.color].b);
  fs.writeFileSync(path.join(outputDir, `${icon.name}.png`), png);
  console.log(`Created: images/${icon.name}.png`);
});

console.log('\nAll icons created successfully!');
