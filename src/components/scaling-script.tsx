/**
 * Inline scaling script — runs before hydration to set viewport-dependent
 * data attributes on <html>. This avoids a flash of the wrong layout.
 *
 * The same attributes are kept in sync by useViewport() at runtime, but
 * the initial paint needs them as early as possible.
 */
export function ScalingScript() {
  const code = `(function(){
    try {
      var w = window.innerWidth;
      var dpr = window.devicePixelRatio || 1;
      var vp = w < 768 ? 'mobile' : (w < 1024 ? 'tablet' : 'desktop');
      var html = document.documentElement;
      html.setAttribute('data-viewport', vp);
      html.setAttribute('data-dpr', String(dpr));
      // Default font scale: xs on mobile, sm on tablet, md on desktop
      var fs = w < 480 ? 'xs' : (w < 768 ? 'sm' : (w < 1440 ? 'md' : 'lg'));
      html.setAttribute('data-font-scale', fs);
      // Default layout mode: split-v on mobile, split-h on tablet/desktop
      var lm = w < 768 ? 'split-v' : 'split-h';
      html.setAttribute('data-layout-mode', lm);
    } catch (e) {}
  })();`;
  return (
    <script
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
