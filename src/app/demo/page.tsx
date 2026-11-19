import { RepositoryProvider } from "@/repositories";
import { AgendaPage } from "@/components/confeiteira/AgendaPage";

export default function Page() {
  return (
    <RepositoryProvider mode="demo">
      <AgendaPage basePath="/demo" />
    </RepositoryProvider>
  );
}
