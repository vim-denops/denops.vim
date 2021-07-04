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
	@deno test --unstable --no-run $$(find . -name '*.ts')

test: FORCE	## Test
	@deno test --unstable -A

FORCE:
