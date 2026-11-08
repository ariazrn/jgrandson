export interface ImpactReport {
  addedRoutes: string[];
  removedRoutes: string[];
  addedSecrets: string[];
  removedSecrets: string[];
  changedBudgets: string[];
  isSafe: boolean;
}

export function compareImpact(previousManifest: any, nextManifest: any): ImpactReport {
  const prevRoutes = new Set<string>((previousManifest.resources?.functions ?? []).map((f: any) => `${f.method} ${f.path}`));
  const nextRoutes = new Set<string>((nextManifest.resources?.functions ?? []).map((f: any) => `${f.method} ${f.path}`));

  const addedRoutes: string[] = [...nextRoutes].filter(r => !prevRoutes.has(r));
  const removedRoutes: string[] = [...prevRoutes].filter(r => !nextRoutes.has(r));

  const prevSecrets = new Set<string>(previousManifest.resources?.secrets?.keys ?? []);
  const nextSecrets = new Set<string>(nextManifest.resources?.secrets?.keys ?? []);

  const addedSecrets: string[] = [...nextSecrets].filter(s => !prevSecrets.has(s));
  const removedSecrets: string[] = [...prevSecrets].filter(s => !nextSecrets.has(s));

  return {
    addedRoutes,
    removedRoutes,
    addedSecrets,
    removedSecrets,
    changedBudgets: [],
    isSafe: removedRoutes.length === 0,
  };
}
