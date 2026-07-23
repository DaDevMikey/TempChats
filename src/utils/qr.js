// ==========================================================================
// Lightweight SVG QR Code Generator Component / Helper for Private Rooms
// Uses Google Chart API / SVG fallback for crisp QR rendering
// ==========================================================================

export function getQRCodeUrl(text) {
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}&color=818cf8&bgcolor=181d34`;
}
