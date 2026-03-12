const AUTHORITATIVE_HOSTS = [
  'cdn002.reblogme.com',
  'cdn013.bdsmlr.com',
  'cdn101.bdsmlr.com',
  'ocdn011.bdsmlr.com',
  'ocdn012.bdsmlr.com'
];

function toS3Scheme(url) {
  if (!url) return '';
  const cleanUrl = url.split('?')[0];
  
  // LOGIC UNDER TEST
  if (cleanUrl.includes('cdn012.bdsmlr.com')) {
    const path = cleanUrl.split('cdn012.bdsmlr.com')[1];
    return `s3://ocdn012.bdsmlr.com${path}`;
  }

  for (const host of AUTHORITATIVE_HOSTS) {
    if (cleanUrl.includes(host)) {
      const path = cleanUrl.split(host)[1];
      return `s3://${host}${path}`;
    }
  }

  const hostMatch = cleanUrl.match(/((?:o?cdn\d+)\.bdsmlr\.com)/);
  if (hostMatch) {
    const host = hostMatch[1];
    const path = cleanUrl.split(host)[1];
    return `s3://${host}${path}`;
  }
  return cleanUrl;
}

const testUrl = "https://cdn012.bdsmlr.com/uploads/photos/2024/01/180267/bdsmlr-180267-8eMOcgXfiY.webp?e=123";
const result = toS3Scheme(testUrl);

console.log("INPUT:  ", testUrl);
console.log("OUTPUT: ", result);

if (result === "s3://ocdn012.bdsmlr.com/uploads/photos/2024/01/180267/bdsmlr-180267-8eMOcgXfiY.webp") {
  console.log("✅ TEST PASSED: cdn012 mapped to ocdn012 and params stripped.");
} else {
  console.log("❌ TEST FAILED!");
  process.exit(1);
}
