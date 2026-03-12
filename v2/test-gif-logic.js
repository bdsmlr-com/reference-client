function isGif(url) {
  if (!url) return false;
  return url.split('?')[0].toLowerCase().endsWith('.gif');
}

function resolveMediaUrl(url, context) {
  if (!url) return '';
  const isTargetGif = url.split('?')[0].toLowerCase().endsWith('.gif');
  
  let parts = [];
  if (isTargetGif && context !== 'poster') {
    parts.push('format:mp4');
  }
  return parts.join('/');
}

const testUrl = "https://ocdn012.bdsmlr.com/u/test.gif?e=123456";

console.log(`URL: ${testUrl}`);
console.log(`isGif: ${isGif(testUrl)}`);
console.log(`Options: ${resolveMediaUrl(testUrl, 'thumbnail')}`);

if (isGif(testUrl) === true && resolveMediaUrl(testUrl, 'thumbnail').includes('format:mp4')) {
  console.log("✅ TDD PASSED: GIF detected with params.");
} else {
  console.log("❌ TDD FAILED!");
  process.exit(1);
}
