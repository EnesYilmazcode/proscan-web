/** The ProScan binoculars, the same mark as the extension and the landing page. */
export function BrandLogo({ size = 30 }: { size?: number }) {
  return <img src="/icon128.png" alt="" width={size} height={size} style={{ borderRadius: Math.round(size / 5), display: 'block' }} />;
}
