import Image from "next/image";
import { cn } from "@/lib/cn";
import type { CorporateImageAsset } from "@/lib/corporate/content";

type Props = {
  image: CorporateImageAsset;
  className?: string;
  priority?: boolean;
};

/**
 * Desktop 16:9 / mobile 4:3 cover crop. Generated photos show an external caption.
 */
export function CorporateProgramImage({ image, className, priority = false }: Props) {
  const desktopPos = image.desktopObjectPosition ?? image.mobileObjectPosition;

  return (
    <figure className={cn("min-w-0", className)}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[var(--surface-muted)] md:hidden">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="100vw"
          priority={priority}
          className={cn("object-cover", image.mobileObjectPosition)}
        />
      </div>
      <div className="relative hidden aspect-video w-full overflow-hidden rounded-2xl bg-[var(--surface-muted)] md:block">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(max-width: 1280px) 720px, 880px"
          priority={priority}
          className={cn("object-cover", desktopPos)}
        />
      </div>
      {image.showExampleCaption ? (
        <figcaption className="mt-2 type-caption text-[var(--text-muted)]">
          프로그램 예시 이미지
        </figcaption>
      ) : null}
    </figure>
  );
}
