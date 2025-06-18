// This is a test code that triggers a constraint error.
// It specifies a non-existent version of an existing package.
//
// The `@std/internal` package exists, but it is not imported from the project.
// It is used to exclude updates with `molt --ignore`.
// See the tasks in *deno.jsonc* for details.
//
// DO NOT UPDATE THIS LINE.
import * as _ from "jsr:@std/internal@1.0.0-non-existent-version";
