// Mirrors the header lockup on storalundby.scout.se: "Stora Lundby" + the
// scout lily + "scoutkår", in the troop's brand blue and Scouterna's
// ScouternaRoundedPro typeface (public/fonts), used under the troop's own
// Scouterna membership license.
export default function Logo({ size = 'md', className = '' }) {
  const textSize = size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl';
  const imgSize = size === 'lg' ? 'h-10 sm:h-14' : 'h-6 sm:h-8';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`font-logo font-bold uppercase tracking-wide text-brand-500 ${textSize}`}>
        Stora Lundby
      </span>
      <img src="/lily-blue.svg" alt="" className={`${imgSize} w-auto`} />
      <span className={`font-logo font-bold uppercase tracking-wide text-brand-500 ${textSize}`}>
        scoutkår
      </span>
    </div>
  );
}
