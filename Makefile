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

FORCE:
