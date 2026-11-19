import { RepositoryProvider } from "@/repositories";
import { AgendaPage } from "@/components/confeiteira/AgendaPage";

export default function Page() {
  return (
    <RepositoryProvider mode="app">
      <AgendaPage basePath="/app" />
    </RepositoryProvider>
  );
}
