TOOLS := ${CURDIR}/.tools

.DEFAULT_GOAL := help

help:
	@cat $(MAKEFILE_LIST) | \
	    perl -ne 'print if /^\w+.*##/;' | \
	    perl -pe 's/(.*):.*##\s*/sprintf("%-20s",$$1)/eg;'

tools: FORCE	## Install development tools
	@mkdir -p ${TOOLS}
	@deno install -f --allow-write --allow-read --allow-net --root ${TOOLS} https://deno.land/x/dlink/dlink.ts

fmt: FORCE	## Format code
	@deno fmt

fmt-check: FORCE	## Format check
	@deno fmt --check

lint: FORCE	## Lint code
	@deno lint

type-check: FORCE	## Type check
	@deno test --unstable --no-run denops/**/*.ts

test: FORCE	## Test
	@deno test --unstable -A

dlink: FORCE	## Update dlink
	@(cd denops/@denops; ${TOOLS}/bin/dlink)
	@(cd denops/@denops-private; ${TOOLS}/bin/dlink)
	@make fmt

FORCE:
