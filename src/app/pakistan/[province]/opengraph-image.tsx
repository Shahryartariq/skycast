import { PROVINCES, citiesIn, provinceBySlug } from "@/lib/cities";
import { OG_SIZE, ogImage } from "@/lib/og";

type Params = { province: string };

export function generateStaticParams() {
  return PROVINCES.map((province) => ({ province: province.slug }));
}

/** One card per province, with alt text that names it. */
export async function generateImageMetadata({ params }: { params: Params | Promise<Params> }) {
  const province = provinceBySlug((await params).province);
  return [
    {
      id: "card",
      alt: province ? `${province.name} weather forecast on Skycast` : "Pakistan weather on Skycast",
      size: OG_SIZE,
      contentType: "image/png",
    },
  ];
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const province = provinceBySlug((await params).province);
  if (!province) return ogImage("Pakistan weather", "Live forecasts by city");
  return ogImage(`${province.name} weather`, `Live forecasts for ${citiesIn(province.slug).length} places`);
}
