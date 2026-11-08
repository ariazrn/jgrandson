import { createServer } from "@jgrandson/runtime";
import { route_post as handler_post__api_chat } from "./g-route_post__api_chat";

const server = createServer({
  routes: {
  "POST /api/chat": handler_post__api_chat,
  }
});

server.start();
