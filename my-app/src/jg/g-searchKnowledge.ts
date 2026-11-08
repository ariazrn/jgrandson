export const searchKnowledgeSchema = {
  "name": "searchKnowledge",
  "description": "Tool searchKnowledge",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string"
      }
    },
    "required": [
      "query"
    ]
  }
};

export async function searchKnowledge(query: string) {
  return ("JGrandson 1.0 Knowledge Base: " + query);
}
