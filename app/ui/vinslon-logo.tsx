import Image from 'next/image';
import vinslonLogo from '@/app/ui/vinslon-logo.png';

export default function VinslonLogo() {
  return (
    <Image
      src={vinslonLogo}
      alt="Vinslon"
      style={{ width: '100%', height: 'auto' }}
      priority
    />
  );
}
