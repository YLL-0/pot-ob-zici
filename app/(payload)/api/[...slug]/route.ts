/* Payload REST API. Answers 503 when the CMS is not configured in this environment. */
import config from "@payload-config";
import "@payloadcms/next/css";
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from "@payloadcms/next/routes";
import { isCmsConfigured } from "@/lib/cms";

type Handler = ReturnType<typeof REST_GET>;

function aliNastavljeno(handler: Handler): Handler {
  return (async (...args: Parameters<Handler>) =>
    isCmsConfigured()
      ? handler(...args)
      : Response.json({ napaka: "Urejanje ni na voljo — baza ni nastavljena." }, { status: 503 })) as Handler;
}

export const GET = aliNastavljeno(REST_GET(config));
export const POST = aliNastavljeno(REST_POST(config));
export const DELETE = aliNastavljeno(REST_DELETE(config));
export const PATCH = aliNastavljeno(REST_PATCH(config));
export const PUT = aliNastavljeno(REST_PUT(config));
export const OPTIONS = aliNastavljeno(REST_OPTIONS(config));
