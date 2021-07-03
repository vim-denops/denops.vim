TOOLS := ${CURDIR}/.tools

tools: FORCE
	@mkdir -p ${TOOLS}
	@deno install -f --allow-write --allow-read --allow-net --root ${TOOLS} https://deno.land/x/dlink/dlink.ts

fmt: FORCE
	@deno fmt

fmt-check: FORCE
	@deno fmt --check

lint: FORCE
	@deno lint

type-check: FORCE
	@deno test --unstable --no-run denops/**/*.ts

test: FORCE
	@deno test --unstable -A

dlink: FORCE
	@(cd denops/@denops; ${TOOLS}/bin/dlink)
	@(cd denops/@denops-private; ${TOOLS}/bin/dlink)
	@make fmt

FORCE:
