TARGETS := $$(find . \( -name '*.ts' -or -name '*.md' \) -not -path './.deno/*')

.DEFAULT_GOAL := help

help:
	@cat $(MAKEFILE_LIST) | \
	    perl -ne 'print if /^\w+.*##/;' | \
	    perl -pe 's/(.*):.*##\s*/sprintf("%-20s",$$1)/eg;'

fmt: FORCE	## Format code
	@deno fmt --config deno.jsonc

fmt-check: FORCE	## Format check
	@deno fmt --check --config deno.jsonc

lint: FORCE	## Lint code
	@deno lint --config deno.jsonc

type-check: FORCE	## Type check
	@deno test --unstable --no-run ${TARGETS}

test: FORCE	## Test
	@deno test --unstable -A --no-check --jobs

deps: FORCE	## Update dependencies
	@deno run -A https://deno.land/x/udd@0.7.2/main.ts ${TARGETS}
	@make fmt

FORCE:
