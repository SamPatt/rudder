import fs from 'fs';
import { createCanvas } from 'canvas';

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background - dark slate color matching the app theme
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, size, size);

  // Create a circular background for the icon
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.35;

  // Gradient background
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  gradient.addColorStop(0, '#22c55e'); // Forest green
  gradient.addColorStop(1, '#16a34a'); // Darker green

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw the ship's wheel emoji (☸) as a simple icon
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('☸', centerX, centerY);

  return canvas.toBuffer('image/png');
}

// Generate all icon sizes
sizes.forEach(size => {
  const iconBuffer = generateIcon(size);
  const filename = `public/icon-${size}.png`;
  fs.writeFileSync(filename, iconBuffer);
  console.log(`Generated ${filename}`);
});

console.log('All PWA icons generated successfully!'); 