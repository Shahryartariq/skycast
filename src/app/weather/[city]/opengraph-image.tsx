import { cityBySlug, CITIES } from "@/lib/cities";
import { OG_SIZE, ogImage } from "@/lib/og";
import { placeRegion } from "@/lib/query";

type Params = { city: string };

export function generateStaticParams() {
  return CITIES.map((city) => ({ city: city.slug }));
}

/** One card per city, with alt text that names it. */
export async function generateImageMetadata({ params }: { params: Params | Promise<Params> }) {
  const city = cityBySlug((await params).city);
  return [
    {
      id: "card",
      alt: city ? `${city.name} weather forecast on Skycast` : "Pakistan weather on Skycast",
      size: OG_SIZE,
      contentType: "image/png",
    },
  ];
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const city = cityBySlug((await params).city);
  if (!city) return ogImage("Pakistan weather", "Hourly and 5-day forecast");
  return ogImage(`${city.name} weather`, placeRegion(city));
}
