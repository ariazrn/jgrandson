export const route_post = async (req: any, res: any) => {
  const prompt = (req as any).prompt as string;
  return searchKnowledge(prompt);
};
