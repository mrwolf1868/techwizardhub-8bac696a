import { AppLayout, PageSection } from "@/components/AppLayout";
import { ServiceGrid, useServices } from "@/components/CatalogCards";

const Services = () => {
  const { items, loading } = useServices();
  return (
    <AppLayout>
      <PageSection title="Services">
        <ServiceGrid items={items} loading={loading} />
      </PageSection>
    </AppLayout>
  );
};

export default Services;
