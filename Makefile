TARGETS := $$(find . -name '*.ts' -or -name '*.md')

.DEFAULT_GOAL := help

help:
	@cat $(MAKEFILE_LIST) | \
	    perl -ne 'print if /^\w+.*##/;' | \
	    perl -pe 's/(.*):.*##\s*/sprintf("%-20s",$$1)/eg;'

fmt: FORCE	## Format code
	@deno fmt

fmt-check: FORCE	## Format check
	@deno fmt --check

lint: FORCE	## Lint code
	@deno lint

type-check: FORCE	## Type check
	@deno test --unstable --no-run --no-check=remote ${TARGETS}

test: FORCE	## Test
	@deno test --unstable -A --no-check

deps: FORCE	## Update dependencies
	@deno run -A --no-check https://deno.land/x/udd@0.8.1/main.ts ${TARGETS}
	@make fmt

FORCE:
