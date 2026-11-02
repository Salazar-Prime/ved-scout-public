import { notFound } from "next/navigation";
import { DemoScreen } from "../../components/demo-screen";

const sections = ["overview", "your-plots", "mission-types", "camera-sensors", "flight-history", "about"];
export function generateStaticParams() { return sections.map((section) => ({ section })); }
export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <DemoScreen section={section} />;
}
