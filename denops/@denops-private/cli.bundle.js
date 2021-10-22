class DenoStdInternalError extends Error {
    constructor(message){
        super(message);
        this.name = "DenoStdInternalError";
    }
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError(msg);
    }
}
const { hasOwn  } = Object;
function get(obj, key) {
    if (hasOwn(obj, key)) {
        return obj[key];
    }
}
function getForce(obj, key) {
    const v = get(obj, key);
    assert(v != null);
    return v;
}
function isNumber(x) {
    if (typeof x === "number") return true;
    if (/^0x[0-9a-f]+$/i.test(String(x))) return true;
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(String(x));
}
function hasKey(obj, keys) {
    let o = obj;
    keys.slice(0, -1).forEach((key)=>{
        o = get(o, key) ?? {
        };
    });
    const key = keys[keys.length - 1];
    return key in o;
}
function parse(args, { "--": doubleDash = false , alias ={
} , boolean: __boolean = false , default: defaults = {
} , stopEarly =false , string =[] , unknown =(i)=>i
  } = {
}) {
    const flags = {
        bools: {
        },
        strings: {
        },
        unknownFn: unknown,
        allBools: false
    };
    if (__boolean !== undefined) {
        if (typeof __boolean === "boolean") {
            flags.allBools = !!__boolean;
        } else {
            const booleanArgs = typeof __boolean === "string" ? [
                __boolean
            ] : __boolean;
            for (const key of booleanArgs.filter(Boolean)){
                flags.bools[key] = true;
            }
        }
    }
    const aliases = {
    };
    if (alias !== undefined) {
        for(const key in alias){
            const val = getForce(alias, key);
            if (typeof val === "string") {
                aliases[key] = [
                    val
                ];
            } else {
                aliases[key] = val;
            }
            for (const alias1 of getForce(aliases, key)){
                aliases[alias1] = [
                    key
                ].concat(aliases[key].filter((y)=>alias1 !== y
                ));
            }
        }
    }
    if (string !== undefined) {
        const stringArgs = typeof string === "string" ? [
            string
        ] : string;
        for (const key of stringArgs.filter(Boolean)){
            flags.strings[key] = true;
            const alias = get(aliases, key);
            if (alias) {
                for (const al of alias){
                    flags.strings[al] = true;
                }
            }
        }
    }
    const argv = {
        _: []
    };
    function argDefined(key, arg) {
        return flags.allBools && /^--[^=]+$/.test(arg) || get(flags.bools, key) || !!get(flags.strings, key) || !!get(aliases, key);
    }
    function setKey(obj, keys, value) {
        let o = obj;
        keys.slice(0, -1).forEach(function(key) {
            if (get(o, key) === undefined) {
                o[key] = {
                };
            }
            o = get(o, key);
        });
        const key = keys[keys.length - 1];
        if (get(o, key) === undefined || get(flags.bools, key) || typeof get(o, key) === "boolean") {
            o[key] = value;
        } else if (Array.isArray(get(o, key))) {
            o[key].push(value);
        } else {
            o[key] = [
                get(o, key),
                value
            ];
        }
    }
    function setArg(key, val, arg = undefined) {
        if (arg && flags.unknownFn && !argDefined(key, arg)) {
            if (flags.unknownFn(arg, key, val) === false) return;
        }
        const value = !get(flags.strings, key) && isNumber(val) ? Number(val) : val;
        setKey(argv, key.split("."), value);
        const alias = get(aliases, key);
        if (alias) {
            for (const x of alias){
                setKey(argv, x.split("."), value);
            }
        }
    }
    function aliasIsBoolean(key) {
        return getForce(aliases, key).some((x)=>typeof get(flags.bools, x) === "boolean"
        );
    }
    for (const key of Object.keys(flags.bools)){
        setArg(key, defaults[key] === undefined ? false : defaults[key]);
    }
    let notFlags = [];
    if (args.includes("--")) {
        notFlags = args.slice(args.indexOf("--") + 1);
        args = args.slice(0, args.indexOf("--"));
    }
    for(let i = 0; i < args.length; i++){
        const arg = args[i];
        if (/^--.+=/.test(arg)) {
            const m = arg.match(/^--([^=]+)=(.*)$/s);
            assert(m != null);
            const [, key, value] = m;
            if (flags.bools[key]) {
                const booleanValue = value !== "false";
                setArg(key, booleanValue, arg);
            } else {
                setArg(key, value, arg);
            }
        } else if (/^--no-.+/.test(arg)) {
            const m = arg.match(/^--no-(.+)/);
            assert(m != null);
            setArg(m[1], false, arg);
        } else if (/^--.+/.test(arg)) {
            const m = arg.match(/^--(.+)/);
            assert(m != null);
            const [, key] = m;
            const next = args[i + 1];
            if (next !== undefined && !/^-/.test(next) && !get(flags.bools, key) && !flags.allBools && (get(aliases, key) ? !aliasIsBoolean(key) : true)) {
                setArg(key, next, arg);
                i++;
            } else if (/^(true|false)$/.test(next)) {
                setArg(key, next === "true", arg);
                i++;
            } else {
                setArg(key, get(flags.strings, key) ? "" : true, arg);
            }
        } else if (/^-[^-]+/.test(arg)) {
            const letters = arg.slice(1, -1).split("");
            let broken = false;
            for(let j = 0; j < letters.length; j++){
                const next = arg.slice(j + 2);
                if (next === "-") {
                    setArg(letters[j], next, arg);
                    continue;
                }
                if (/[A-Za-z]/.test(letters[j]) && /=/.test(next)) {
                    setArg(letters[j], next.split(/=(.+)/)[1], arg);
                    broken = true;
                    break;
                }
                if (/[A-Za-z]/.test(letters[j]) && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
                    setArg(letters[j], next, arg);
                    broken = true;
                    break;
                }
                if (letters[j + 1] && letters[j + 1].match(/\W/)) {
                    setArg(letters[j], arg.slice(j + 2), arg);
                    broken = true;
                    break;
                } else {
                    setArg(letters[j], get(flags.strings, letters[j]) ? "" : true, arg);
                }
            }
            const [key] = arg.slice(-1);
            if (!broken && key !== "-") {
                if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1]) && !get(flags.bools, key) && (get(aliases, key) ? !aliasIsBoolean(key) : true)) {
                    setArg(key, args[i + 1], arg);
                    i++;
                } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
                    setArg(key, args[i + 1] === "true", arg);
                    i++;
                } else {
                    setArg(key, get(flags.strings, key) ? "" : true, arg);
                }
            }
        } else {
            if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
                argv._.push(flags.strings["_"] ?? !isNumber(arg) ? arg : Number(arg));
            }
            if (stopEarly) {
                argv._.push(...args.slice(i + 1));
                break;
            }
        }
    }
    for (const key1 of Object.keys(defaults)){
        if (!hasKey(argv, key1.split("."))) {
            setKey(argv, key1.split("."), defaults[key1]);
            if (aliases[key1]) {
                for (const x of aliases[key1]){
                    setKey(argv, x.split("."), defaults[key1]);
                }
            }
        }
    }
    if (doubleDash) {
        argv["--"] = [];
        for (const key of notFlags){
            argv["--"].push(key);
        }
    } else {
        for (const key of notFlags){
            argv._.push(key);
        }
    }
    return argv;
}
const mod = {
    parse: parse
};
const osType = (()=>{
    const { Deno  } = globalThis;
    if (typeof Deno?.build?.os === "string") {
        return Deno.build.os;
    }
    const { navigator  } = globalThis;
    if (navigator?.appVersion?.includes?.("Win") ?? false) {
        return "windows";
    }
    return "linux";
})();
const isWindows = osType === "windows";
const CHAR_FORWARD_SLASH = 47;
function assertPath(path) {
    if (typeof path !== "string") {
        throw new TypeError(`Path must be a string. Received ${JSON.stringify(path)}`);
    }
}
function isPosixPathSeparator(code) {
    return code === 47;
}
function isPathSeparator(code) {
    return isPosixPathSeparator(code) || code === 92;
}
function isWindowsDeviceRoot(code) {
    return code >= 97 && code <= 122 || code >= 65 && code <= 90;
}
function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
    let res = "";
    let lastSegmentLength = 0;
    let lastSlash = -1;
    let dots = 0;
    let code;
    for(let i = 0, len = path.length; i <= len; ++i){
        if (i < len) code = path.charCodeAt(i);
        else if (isPathSeparator(code)) break;
        else code = CHAR_FORWARD_SLASH;
        if (isPathSeparator(code)) {
            if (lastSlash === i - 1 || dots === 1) {
            } else if (lastSlash !== i - 1 && dots === 2) {
                if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
                    if (res.length > 2) {
                        const lastSlashIndex = res.lastIndexOf(separator);
                        if (lastSlashIndex === -1) {
                            res = "";
                            lastSegmentLength = 0;
                        } else {
                            res = res.slice(0, lastSlashIndex);
                            lastSegmentLength = res.length - 1 - res.lastIndexOf(separator);
                        }
                        lastSlash = i;
                        dots = 0;
                        continue;
                    } else if (res.length === 2 || res.length === 1) {
                        res = "";
                        lastSegmentLength = 0;
                        lastSlash = i;
                        dots = 0;
                        continue;
                    }
                }
                if (allowAboveRoot) {
                    if (res.length > 0) res += `${separator}..`;
                    else res = "..";
                    lastSegmentLength = 2;
                }
            } else {
                if (res.length > 0) res += separator + path.slice(lastSlash + 1, i);
                else res = path.slice(lastSlash + 1, i);
                lastSegmentLength = i - lastSlash - 1;
            }
            lastSlash = i;
            dots = 0;
        } else if (code === 46 && dots !== -1) {
            ++dots;
        } else {
            dots = -1;
        }
    }
    return res;
}
function _format(sep, pathObject) {
    const dir = pathObject.dir || pathObject.root;
    const base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
    if (!dir) return base;
    if (dir === pathObject.root) return dir + base;
    return dir + sep + base;
}
const WHITESPACE_ENCODINGS = {
    "\u0009": "%09",
    "\u000A": "%0A",
    "\u000B": "%0B",
    "\u000C": "%0C",
    "\u000D": "%0D",
    "\u0020": "%20"
};
function encodeWhitespace(string) {
    return string.replaceAll(/[\s]/g, (c)=>{
        return WHITESPACE_ENCODINGS[c] ?? c;
    });
}
const sep = "\\";
const delimiter = ";";
function resolve(...pathSegments) {
    let resolvedDevice = "";
    let resolvedTail = "";
    let resolvedAbsolute = false;
    for(let i = pathSegments.length - 1; i >= -1; i--){
        let path;
        const { Deno  } = globalThis;
        if (i >= 0) {
            path = pathSegments[i];
        } else if (!resolvedDevice) {
            if (typeof Deno?.cwd !== "function") {
                throw new TypeError("Resolved a drive-letter-less path without a CWD.");
            }
            path = Deno.cwd();
        } else {
            if (typeof Deno?.env?.get !== "function" || typeof Deno?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a CWD.");
            }
            path = Deno.cwd();
            if (path === undefined || path.slice(0, 3).toLowerCase() !== `${resolvedDevice.toLowerCase()}\\`) {
                path = `${resolvedDevice}\\`;
            }
        }
        assertPath(path);
        const len = path.length;
        if (len === 0) continue;
        let rootEnd = 0;
        let device = "";
        let isAbsolute = false;
        const code = path.charCodeAt(0);
        if (len > 1) {
            if (isPathSeparator(code)) {
                isAbsolute = true;
                if (isPathSeparator(path.charCodeAt(1))) {
                    let j = 2;
                    let last = j;
                    for(; j < len; ++j){
                        if (isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        const firstPart = path.slice(last, j);
                        last = j;
                        for(; j < len; ++j){
                            if (!isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j < len && j !== last) {
                            last = j;
                            for(; j < len; ++j){
                                if (isPathSeparator(path.charCodeAt(j))) break;
                            }
                            if (j === len) {
                                device = `\\\\${firstPart}\\${path.slice(last)}`;
                                rootEnd = j;
                            } else if (j !== last) {
                                device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                                rootEnd = j;
                            }
                        }
                    }
                } else {
                    rootEnd = 1;
                }
            } else if (isWindowsDeviceRoot(code)) {
                if (path.charCodeAt(1) === 58) {
                    device = path.slice(0, 2);
                    rootEnd = 2;
                    if (len > 2) {
                        if (isPathSeparator(path.charCodeAt(2))) {
                            isAbsolute = true;
                            rootEnd = 3;
                        }
                    }
                }
            }
        } else if (isPathSeparator(code)) {
            rootEnd = 1;
            isAbsolute = true;
        }
        if (device.length > 0 && resolvedDevice.length > 0 && device.toLowerCase() !== resolvedDevice.toLowerCase()) {
            continue;
        }
        if (resolvedDevice.length === 0 && device.length > 0) {
            resolvedDevice = device;
        }
        if (!resolvedAbsolute) {
            resolvedTail = `${path.slice(rootEnd)}\\${resolvedTail}`;
            resolvedAbsolute = isAbsolute;
        }
        if (resolvedAbsolute && resolvedDevice.length > 0) break;
    }
    resolvedTail = normalizeString(resolvedTail, !resolvedAbsolute, "\\", isPathSeparator);
    return resolvedDevice + (resolvedAbsolute ? "\\" : "") + resolvedTail || ".";
}
function normalize(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return ".";
    let rootEnd = 0;
    let device;
    let isAbsolute = false;
    const code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            isAbsolute = true;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    const firstPart = path.slice(last, j);
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            return `\\\\${firstPart}\\${path.slice(last)}\\`;
                        } else if (j !== last) {
                            device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                            rootEnd = j;
                        }
                    }
                }
            } else {
                rootEnd = 1;
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                device = path.slice(0, 2);
                rootEnd = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) {
                        isAbsolute = true;
                        rootEnd = 3;
                    }
                }
            }
        }
    } else if (isPathSeparator(code)) {
        return "\\";
    }
    let tail;
    if (rootEnd < len) {
        tail = normalizeString(path.slice(rootEnd), !isAbsolute, "\\", isPathSeparator);
    } else {
        tail = "";
    }
    if (tail.length === 0 && !isAbsolute) tail = ".";
    if (tail.length > 0 && isPathSeparator(path.charCodeAt(len - 1))) {
        tail += "\\";
    }
    if (device === undefined) {
        if (isAbsolute) {
            if (tail.length > 0) return `\\${tail}`;
            else return "\\";
        } else if (tail.length > 0) {
            return tail;
        } else {
            return "";
        }
    } else if (isAbsolute) {
        if (tail.length > 0) return `${device}\\${tail}`;
        else return `${device}\\`;
    } else if (tail.length > 0) {
        return device + tail;
    } else {
        return device;
    }
}
function isAbsolute(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return false;
    const code = path.charCodeAt(0);
    if (isPathSeparator(code)) {
        return true;
    } else if (isWindowsDeviceRoot(code)) {
        if (len > 2 && path.charCodeAt(1) === 58) {
            if (isPathSeparator(path.charCodeAt(2))) return true;
        }
    }
    return false;
}
function join(...paths) {
    const pathsCount = paths.length;
    if (pathsCount === 0) return ".";
    let joined;
    let firstPart = null;
    for(let i = 0; i < pathsCount; ++i){
        const path = paths[i];
        assertPath(path);
        if (path.length > 0) {
            if (joined === undefined) joined = firstPart = path;
            else joined += `\\${path}`;
        }
    }
    if (joined === undefined) return ".";
    let needsReplace = true;
    let slashCount = 0;
    assert(firstPart != null);
    if (isPathSeparator(firstPart.charCodeAt(0))) {
        ++slashCount;
        const firstLen = firstPart.length;
        if (firstLen > 1) {
            if (isPathSeparator(firstPart.charCodeAt(1))) {
                ++slashCount;
                if (firstLen > 2) {
                    if (isPathSeparator(firstPart.charCodeAt(2))) ++slashCount;
                    else {
                        needsReplace = false;
                    }
                }
            }
        }
    }
    if (needsReplace) {
        for(; slashCount < joined.length; ++slashCount){
            if (!isPathSeparator(joined.charCodeAt(slashCount))) break;
        }
        if (slashCount >= 2) joined = `\\${joined.slice(slashCount)}`;
    }
    return normalize(joined);
}
function relative(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return "";
    const fromOrig = resolve(from);
    const toOrig = resolve(to);
    if (fromOrig === toOrig) return "";
    from = fromOrig.toLowerCase();
    to = toOrig.toLowerCase();
    if (from === to) return "";
    let fromStart = 0;
    let fromEnd = from.length;
    for(; fromStart < fromEnd; ++fromStart){
        if (from.charCodeAt(fromStart) !== 92) break;
    }
    for(; fromEnd - 1 > fromStart; --fromEnd){
        if (from.charCodeAt(fromEnd - 1) !== 92) break;
    }
    const fromLen = fromEnd - fromStart;
    let toStart = 0;
    let toEnd = to.length;
    for(; toStart < toEnd; ++toStart){
        if (to.charCodeAt(toStart) !== 92) break;
    }
    for(; toEnd - 1 > toStart; --toEnd){
        if (to.charCodeAt(toEnd - 1) !== 92) break;
    }
    const toLen = toEnd - toStart;
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for(; i <= length; ++i){
        if (i === length) {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === 92) {
                    return toOrig.slice(toStart + i + 1);
                } else if (i === 2) {
                    return toOrig.slice(toStart + i);
                }
            }
            if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === 92) {
                    lastCommonSep = i;
                } else if (i === 2) {
                    lastCommonSep = 3;
                }
            }
            break;
        }
        const fromCode = from.charCodeAt(fromStart + i);
        const toCode = to.charCodeAt(toStart + i);
        if (fromCode !== toCode) break;
        else if (fromCode === 92) lastCommonSep = i;
    }
    if (i !== length && lastCommonSep === -1) {
        return toOrig;
    }
    let out = "";
    if (lastCommonSep === -1) lastCommonSep = 0;
    for(i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i){
        if (i === fromEnd || from.charCodeAt(i) === 92) {
            if (out.length === 0) out += "..";
            else out += "\\..";
        }
    }
    if (out.length > 0) {
        return out + toOrig.slice(toStart + lastCommonSep, toEnd);
    } else {
        toStart += lastCommonSep;
        if (toOrig.charCodeAt(toStart) === 92) ++toStart;
        return toOrig.slice(toStart, toEnd);
    }
}
function toNamespacedPath(path) {
    if (typeof path !== "string") return path;
    if (path.length === 0) return "";
    const resolvedPath = resolve(path);
    if (resolvedPath.length >= 3) {
        if (resolvedPath.charCodeAt(0) === 92) {
            if (resolvedPath.charCodeAt(1) === 92) {
                const code = resolvedPath.charCodeAt(2);
                if (code !== 63 && code !== 46) {
                    return `\\\\?\\UNC\\${resolvedPath.slice(2)}`;
                }
            }
        } else if (isWindowsDeviceRoot(resolvedPath.charCodeAt(0))) {
            if (resolvedPath.charCodeAt(1) === 58 && resolvedPath.charCodeAt(2) === 92) {
                return `\\\\?\\${resolvedPath}`;
            }
        }
    }
    return path;
}
function dirname(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return ".";
    let rootEnd = -1;
    let end = -1;
    let matchedSlash = true;
    let offset = 0;
    const code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            rootEnd = offset = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            return path;
                        }
                        if (j !== last) {
                            rootEnd = offset = j + 1;
                        }
                    }
                }
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                rootEnd = offset = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) rootEnd = offset = 3;
                }
            }
        }
    } else if (isPathSeparator(code)) {
        return path;
    }
    for(let i = len - 1; i >= offset; --i){
        if (isPathSeparator(path.charCodeAt(i))) {
            if (!matchedSlash) {
                end = i;
                break;
            }
        } else {
            matchedSlash = false;
        }
    }
    if (end === -1) {
        if (rootEnd === -1) return ".";
        else end = rootEnd;
    }
    return path.slice(0, end);
}
function basename(path, ext = "") {
    if (ext !== undefined && typeof ext !== "string") {
        throw new TypeError('"ext" argument must be a string');
    }
    assertPath(path);
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (path.length >= 2) {
        const drive = path.charCodeAt(0);
        if (isWindowsDeviceRoot(drive)) {
            if (path.charCodeAt(1) === 58) start = 2;
        }
    }
    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
        if (ext.length === path.length && ext === path) return "";
        let extIdx = ext.length - 1;
        let firstNonSlashEnd = -1;
        for(i = path.length - 1; i >= start; --i){
            const code = path.charCodeAt(i);
            if (isPathSeparator(code)) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else {
                if (firstNonSlashEnd === -1) {
                    matchedSlash = false;
                    firstNonSlashEnd = i + 1;
                }
                if (extIdx >= 0) {
                    if (code === ext.charCodeAt(extIdx)) {
                        if (--extIdx === -1) {
                            end = i;
                        }
                    } else {
                        extIdx = -1;
                        end = firstNonSlashEnd;
                    }
                }
            }
        }
        if (start === end) end = firstNonSlashEnd;
        else if (end === -1) end = path.length;
        return path.slice(start, end);
    } else {
        for(i = path.length - 1; i >= start; --i){
            if (isPathSeparator(path.charCodeAt(i))) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else if (end === -1) {
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1) return "";
        return path.slice(start, end);
    }
}
function extname(path) {
    assertPath(path);
    let start = 0;
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    if (path.length >= 2 && path.charCodeAt(1) === 58 && isWindowsDeviceRoot(path.charCodeAt(0))) {
        start = startPart = 2;
    }
    for(let i = path.length - 1; i >= start; --i){
        const code = path.charCodeAt(i);
        if (isPathSeparator(code)) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        return "";
    }
    return path.slice(startDot, end);
}
function format(pathObject) {
    if (pathObject === null || typeof pathObject !== "object") {
        throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
    }
    return _format("\\", pathObject);
}
function parse1(path) {
    assertPath(path);
    const ret = {
        root: "",
        dir: "",
        base: "",
        ext: "",
        name: ""
    };
    const len = path.length;
    if (len === 0) return ret;
    let rootEnd = 0;
    let code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            rootEnd = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            rootEnd = j;
                        } else if (j !== last) {
                            rootEnd = j + 1;
                        }
                    }
                }
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                rootEnd = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) {
                        if (len === 3) {
                            ret.root = ret.dir = path;
                            return ret;
                        }
                        rootEnd = 3;
                    }
                } else {
                    ret.root = ret.dir = path;
                    return ret;
                }
            }
        }
    } else if (isPathSeparator(code)) {
        ret.root = ret.dir = path;
        return ret;
    }
    if (rootEnd > 0) ret.root = path.slice(0, rootEnd);
    let startDot = -1;
    let startPart = rootEnd;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    let preDotState = 0;
    for(; i >= rootEnd; --i){
        code = path.charCodeAt(i);
        if (isPathSeparator(code)) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        if (end !== -1) {
            ret.base = ret.name = path.slice(startPart, end);
        }
    } else {
        ret.name = path.slice(startPart, startDot);
        ret.base = path.slice(startPart, end);
        ret.ext = path.slice(startDot, end);
    }
    if (startPart > 0 && startPart !== rootEnd) {
        ret.dir = path.slice(0, startPart - 1);
    } else ret.dir = ret.root;
    return ret;
}
function fromFileUrl(url) {
    url = url instanceof URL ? url : new URL(url);
    if (url.protocol != "file:") {
        throw new TypeError("Must be a file URL.");
    }
    let path = decodeURIComponent(url.pathname.replace(/\//g, "\\").replace(/%(?![0-9A-Fa-f]{2})/g, "%25")).replace(/^\\*([A-Za-z]:)(\\|$)/, "$1\\");
    if (url.hostname != "") {
        path = `\\\\${url.hostname}${path}`;
    }
    return path;
}
function toFileUrl(path) {
    if (!isAbsolute(path)) {
        throw new TypeError("Must be an absolute path.");
    }
    const [, hostname, pathname] = path.match(/^(?:[/\\]{2}([^/\\]+)(?=[/\\](?:[^/\\]|$)))?(.*)/);
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(pathname.replace(/%/g, "%25"));
    if (hostname != null && hostname != "localhost") {
        url.hostname = hostname;
        if (!url.hostname) {
            throw new TypeError("Invalid hostname.");
        }
    }
    return url;
}
const mod1 = {
    sep: sep,
    delimiter: delimiter,
    resolve: resolve,
    normalize: normalize,
    isAbsolute: isAbsolute,
    join: join,
    relative: relative,
    toNamespacedPath: toNamespacedPath,
    dirname: dirname,
    basename: basename,
    extname: extname,
    format: format,
    parse: parse1,
    fromFileUrl: fromFileUrl,
    toFileUrl: toFileUrl
};
const sep1 = "/";
const delimiter1 = ":";
function resolve1(...pathSegments) {
    let resolvedPath = "";
    let resolvedAbsolute = false;
    for(let i = pathSegments.length - 1; i >= -1 && !resolvedAbsolute; i--){
        let path;
        if (i >= 0) path = pathSegments[i];
        else {
            const { Deno  } = globalThis;
            if (typeof Deno?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a CWD.");
            }
            path = Deno.cwd();
        }
        assertPath(path);
        if (path.length === 0) {
            continue;
        }
        resolvedPath = `${path}/${resolvedPath}`;
        resolvedAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    }
    resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, "/", isPosixPathSeparator);
    if (resolvedAbsolute) {
        if (resolvedPath.length > 0) return `/${resolvedPath}`;
        else return "/";
    } else if (resolvedPath.length > 0) return resolvedPath;
    else return ".";
}
function normalize1(path) {
    assertPath(path);
    if (path.length === 0) return ".";
    const isAbsolute = path.charCodeAt(0) === 47;
    const trailingSeparator = path.charCodeAt(path.length - 1) === 47;
    path = normalizeString(path, !isAbsolute, "/", isPosixPathSeparator);
    if (path.length === 0 && !isAbsolute) path = ".";
    if (path.length > 0 && trailingSeparator) path += "/";
    if (isAbsolute) return `/${path}`;
    return path;
}
function isAbsolute1(path) {
    assertPath(path);
    return path.length > 0 && path.charCodeAt(0) === 47;
}
function join1(...paths) {
    if (paths.length === 0) return ".";
    let joined;
    for(let i = 0, len = paths.length; i < len; ++i){
        const path = paths[i];
        assertPath(path);
        if (path.length > 0) {
            if (!joined) joined = path;
            else joined += `/${path}`;
        }
    }
    if (!joined) return ".";
    return normalize1(joined);
}
function relative1(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return "";
    from = resolve1(from);
    to = resolve1(to);
    if (from === to) return "";
    let fromStart = 1;
    const fromEnd = from.length;
    for(; fromStart < fromEnd; ++fromStart){
        if (from.charCodeAt(fromStart) !== 47) break;
    }
    const fromLen = fromEnd - fromStart;
    let toStart = 1;
    const toEnd = to.length;
    for(; toStart < toEnd; ++toStart){
        if (to.charCodeAt(toStart) !== 47) break;
    }
    const toLen = toEnd - toStart;
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for(; i <= length; ++i){
        if (i === length) {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === 47) {
                    return to.slice(toStart + i + 1);
                } else if (i === 0) {
                    return to.slice(toStart + i);
                }
            } else if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === 47) {
                    lastCommonSep = i;
                } else if (i === 0) {
                    lastCommonSep = 0;
                }
            }
            break;
        }
        const fromCode = from.charCodeAt(fromStart + i);
        const toCode = to.charCodeAt(toStart + i);
        if (fromCode !== toCode) break;
        else if (fromCode === 47) lastCommonSep = i;
    }
    let out = "";
    for(i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i){
        if (i === fromEnd || from.charCodeAt(i) === 47) {
            if (out.length === 0) out += "..";
            else out += "/..";
        }
    }
    if (out.length > 0) return out + to.slice(toStart + lastCommonSep);
    else {
        toStart += lastCommonSep;
        if (to.charCodeAt(toStart) === 47) ++toStart;
        return to.slice(toStart);
    }
}
function toNamespacedPath1(path) {
    return path;
}
function dirname1(path) {
    assertPath(path);
    if (path.length === 0) return ".";
    const hasRoot = path.charCodeAt(0) === 47;
    let end = -1;
    let matchedSlash = true;
    for(let i = path.length - 1; i >= 1; --i){
        if (path.charCodeAt(i) === 47) {
            if (!matchedSlash) {
                end = i;
                break;
            }
        } else {
            matchedSlash = false;
        }
    }
    if (end === -1) return hasRoot ? "/" : ".";
    if (hasRoot && end === 1) return "//";
    return path.slice(0, end);
}
function basename1(path, ext = "") {
    if (ext !== undefined && typeof ext !== "string") {
        throw new TypeError('"ext" argument must be a string');
    }
    assertPath(path);
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
        if (ext.length === path.length && ext === path) return "";
        let extIdx = ext.length - 1;
        let firstNonSlashEnd = -1;
        for(i = path.length - 1; i >= 0; --i){
            const code = path.charCodeAt(i);
            if (code === 47) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else {
                if (firstNonSlashEnd === -1) {
                    matchedSlash = false;
                    firstNonSlashEnd = i + 1;
                }
                if (extIdx >= 0) {
                    if (code === ext.charCodeAt(extIdx)) {
                        if (--extIdx === -1) {
                            end = i;
                        }
                    } else {
                        extIdx = -1;
                        end = firstNonSlashEnd;
                    }
                }
            }
        }
        if (start === end) end = firstNonSlashEnd;
        else if (end === -1) end = path.length;
        return path.slice(start, end);
    } else {
        for(i = path.length - 1; i >= 0; --i){
            if (path.charCodeAt(i) === 47) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else if (end === -1) {
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1) return "";
        return path.slice(start, end);
    }
}
function extname1(path) {
    assertPath(path);
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    for(let i = path.length - 1; i >= 0; --i){
        const code = path.charCodeAt(i);
        if (code === 47) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        return "";
    }
    return path.slice(startDot, end);
}
function format1(pathObject) {
    if (pathObject === null || typeof pathObject !== "object") {
        throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
    }
    return _format("/", pathObject);
}
function parse2(path) {
    assertPath(path);
    const ret = {
        root: "",
        dir: "",
        base: "",
        ext: "",
        name: ""
    };
    if (path.length === 0) return ret;
    const isAbsolute = path.charCodeAt(0) === 47;
    let start;
    if (isAbsolute) {
        ret.root = "/";
        start = 1;
    } else {
        start = 0;
    }
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    let preDotState = 0;
    for(; i >= start; --i){
        const code = path.charCodeAt(i);
        if (code === 47) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        if (end !== -1) {
            if (startPart === 0 && isAbsolute) {
                ret.base = ret.name = path.slice(1, end);
            } else {
                ret.base = ret.name = path.slice(startPart, end);
            }
        }
    } else {
        if (startPart === 0 && isAbsolute) {
            ret.name = path.slice(1, startDot);
            ret.base = path.slice(1, end);
        } else {
            ret.name = path.slice(startPart, startDot);
            ret.base = path.slice(startPart, end);
        }
        ret.ext = path.slice(startDot, end);
    }
    if (startPart > 0) ret.dir = path.slice(0, startPart - 1);
    else if (isAbsolute) ret.dir = "/";
    return ret;
}
function fromFileUrl1(url) {
    url = url instanceof URL ? url : new URL(url);
    if (url.protocol != "file:") {
        throw new TypeError("Must be a file URL.");
    }
    return decodeURIComponent(url.pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
}
function toFileUrl1(path) {
    if (!isAbsolute1(path)) {
        throw new TypeError("Must be an absolute path.");
    }
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(path.replace(/%/g, "%25").replace(/\\/g, "%5C"));
    return url;
}
const mod2 = {
    sep: sep1,
    delimiter: delimiter1,
    resolve: resolve1,
    normalize: normalize1,
    isAbsolute: isAbsolute1,
    join: join1,
    relative: relative1,
    toNamespacedPath: toNamespacedPath1,
    dirname: dirname1,
    basename: basename1,
    extname: extname1,
    format: format1,
    parse: parse2,
    fromFileUrl: fromFileUrl1,
    toFileUrl: toFileUrl1
};
const path = isWindows ? mod1 : mod2;
const { join: join2 , normalize: normalize2  } = path;
const path1 = isWindows ? mod1 : mod2;
const { basename: basename2 , delimiter: delimiter2 , dirname: dirname2 , extname: extname2 , format: format2 , fromFileUrl: fromFileUrl2 , isAbsolute: isAbsolute2 , join: join3 , normalize: normalize3 , parse: parse3 , relative: relative2 , resolve: resolve2 , sep: sep2 , toFileUrl: toFileUrl2 , toNamespacedPath: toNamespacedPath2 ,  } = path1;
function isString(x) {
    return typeof x === "string";
}
function isArray(x, pred) {
    return Array.isArray(x) && (!pred || x.every(pred));
}
class EnsureError extends Error {
    constructor(message){
        super(message);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, EnsureError);
        }
        this.name = "EnsureError";
    }
}
function ensure(x, pred, message = "The value is not expected type") {
    if (!pred(x)) {
        throw new EnsureError(message);
    }
}
function ensureString(x) {
    return ensure(x, isString, "The value must be string");
}
function ensureArray(x, ipred) {
    const pred = (x)=>isArray(x, ipred)
    ;
    return ensure(x, pred, "The value must be array");
}
function deferred() {
    let methods;
    const promise = new Promise((resolve, reject)=>{
        methods = {
            resolve,
            reject
        };
    });
    return Object.assign(promise, methods);
}
class Lock {
    #waiters;
    constructor(){
        this.#waiters = [];
    }
    async with(callback) {
        await this.acquire();
        try {
            await (callback() ?? Promise.resolve());
        } finally{
            this.release();
        }
    }
    async acquire() {
        const waiters = [
            ...this.#waiters
        ];
        this.#waiters.push(deferred());
        if (waiters.length) {
            await Promise.all(waiters);
        }
        return true;
    }
    release() {
        const waiter = this.#waiters.shift();
        if (waiter) {
            waiter.resolve();
        } else {
            throw new Error("The lock is not locked");
        }
    }
    locked() {
        return !!this.#waiters.length;
    }
}
class Event {
    #waiter;
    constructor(){
        this.#waiter = deferred();
    }
    async wait() {
        if (this.#waiter) {
            await this.#waiter;
        }
        return true;
    }
    set() {
        if (this.#waiter) {
            this.#waiter.resolve();
            this.#waiter = null;
        }
    }
    clear() {
        if (!this.#waiter) {
            this.#waiter = deferred();
        }
    }
    is_set() {
        return !this.#waiter;
    }
}
class Condition {
    #lock;
    #waiters;
    constructor(lock){
        this.#lock = lock ?? new Lock();
        this.#waiters = [];
    }
    async with(callback) {
        await this.acquire();
        try {
            await (callback() ?? Promise.resolve());
        } finally{
            this.release();
        }
    }
    async acquire() {
        await this.#lock.acquire();
        return true;
    }
    release() {
        this.#lock.release();
    }
    locked() {
        return this.#lock.locked();
    }
    notify(n = 1) {
        if (!this.locked()) {
            throw new Error("The lock is not acquired");
        }
        for (const i of Array(n)){
            const waiter = this.#waiters.shift();
            if (!waiter) {
                break;
            }
            waiter.set();
        }
    }
    notify_all() {
        this.notify(this.#waiters.length);
    }
    async wait() {
        if (!this.locked()) {
            throw new Error("The lock is not acquired");
        }
        const event = new Event();
        this.#waiters.push(event);
        this.release();
        await event.wait();
        await this.acquire();
        return true;
    }
    async wait_for(predicate) {
        while(!predicate()){
            await this.wait();
        }
    }
}
class QueueEmpty extends Error {
}
class QueueFull extends Error {
}
class Queue {
    #queue;
    #maxsize;
    #full_notifier;
    #empty_notifier;
    constructor(maxsize = 0){
        this.#queue = [];
        this.#maxsize = maxsize <= 0 ? 0 : maxsize;
        this.#full_notifier = new Condition();
        this.#empty_notifier = new Condition();
    }
    empty() {
        return !this.#queue.length;
    }
    full() {
        return !!this.#maxsize && this.#queue.length === this.#maxsize;
    }
    async get() {
        const value = this.#queue.shift();
        if (!value) {
            return new Promise((resolve)=>{
                this.#empty_notifier.with(async ()=>{
                    await this.#empty_notifier.wait_for(()=>!!this.#queue.length
                    );
                    resolve(await this.get());
                });
            });
        }
        await this.#full_notifier.with(()=>{
            this.#full_notifier.notify();
        });
        return value;
    }
    get_nowait() {
        const value = this.#queue.shift();
        if (!value) {
            throw new QueueEmpty("Queue empty");
        }
        this.#full_notifier.with(()=>{
            this.#full_notifier.notify();
        });
        return value;
    }
    async put(value) {
        if (this.#maxsize && this.#queue.length >= this.#maxsize) {
            await this.#full_notifier.with(async ()=>{
                await this.#full_notifier.wait_for(()=>this.#queue.length < this.#maxsize
                );
                await this.put(value);
            });
            return;
        }
        await this.#empty_notifier.with(()=>{
            this.#empty_notifier.notify();
        });
        this.#queue.push(value);
    }
    put_nowait(value) {
        if (this.#maxsize && this.#queue.length >= this.#maxsize) {
            throw new QueueFull("Queue full");
        }
        this.#empty_notifier.with(()=>{
            this.#empty_notifier.notify();
        });
        this.#queue.push(value);
    }
    qsize() {
        return this.#queue.length;
    }
}
function deferred1() {
    let methods;
    let state = "pending";
    const promise = new Promise((resolve, reject)=>{
        methods = {
            async resolve (value) {
                await value;
                state = "fulfilled";
                resolve(value);
            },
            reject (reason) {
                state = "rejected";
                reject(reason);
            }
        };
    });
    Object.defineProperty(promise, "state", {
        get: ()=>state
    });
    return Object.assign(promise, methods);
}
const semver = /^v?(?:\d+)(\.(?:[x*]|\d+)(\.(?:[x*]|\d+)(\.(?:[x*]|\d+))?(?:-[\da-z\-]+(?:\.[\da-z\-]+)*)?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?)?)?$/i;
const indexOrEnd = (str, q)=>{
    return str.indexOf(q) === -1 ? str.length : str.indexOf(q);
};
const split = (v)=>{
    const c = v.replace(/^v/, "").replace(/\+.*$/, "");
    const patchIndex = indexOrEnd(c, "-");
    const arr = c.substring(0, patchIndex).split(".");
    arr.push(c.substring(patchIndex + 1));
    return arr;
};
const tryParse = (v)=>{
    return isNaN(Number(v)) ? v : Number(v);
};
const validate = (version)=>{
    if (typeof version !== "string") {
        throw new TypeError("Invalid argument expected string");
    }
    if (!semver.test(version)) {
        throw new Error("Invalid argument not valid semver ('" + version + "' received)");
    }
};
const compareVersions = (v1, v2)=>{
    [
        v1,
        v2
    ].forEach(validate);
    const s1 = split(v1);
    const s2 = split(v2);
    for(let i = 0; i < Math.max(s1.length - 1, s2.length - 1); i++){
        const n1 = parseInt(s1[i] || "0", 10);
        const n2 = parseInt(s2[i] || "0", 10);
        if (n1 > n2) return 1;
        if (n2 > n1) return -1;
    }
    const sp1 = s1[s1.length - 1];
    const sp2 = s2[s2.length - 1];
    if (sp1 && sp2) {
        const p1 = sp1.split(".").map(tryParse);
        const p2 = sp2.split(".").map(tryParse);
        for(let i = 0; i < Math.max(p1.length, p2.length); i++){
            if (p1[i] === undefined || typeof p2[i] === "string" && typeof p1[i] === "number") {
                return -1;
            }
            if (p2[i] === undefined || typeof p1[i] === "string" && typeof p2[i] === "number") {
                return 1;
            }
            if (p1[i] > p2[i]) return 1;
            if (p2[i] > p1[i]) return -1;
        }
    } else if (sp1 || sp2) {
        return sp1 ? -1 : 1;
    }
    return 0;
};
const allowedOperators = [
    ">",
    ">=",
    "=",
    "<",
    "<=", 
];
const operatorResMap = {
    ">": [
        1
    ],
    ">=": [
        0,
        1
    ],
    "=": [
        0
    ],
    "<=": [
        -1,
        0
    ],
    "<": [
        -1
    ]
};
const validateOperator = (op)=>{
    if (typeof op !== "string") {
        throw new TypeError("Invalid operator type, expected string but got " + typeof op);
    }
    if (allowedOperators.indexOf(op) === -1) {
        throw new TypeError("Invalid operator, expected one of " + allowedOperators.join("|"));
    }
};
compareVersions.validate = (version)=>{
    return typeof version === "string" && semver.test(version);
};
compareVersions.compare = (v1, v2, operator)=>{
    validateOperator(operator);
    const res = compareVersions(v1, v2);
    return operatorResMap[operator].indexOf(res) > -1;
};
class WorkerReader {
    #queue;
    #remain;
    #closed;
    #waiter;
    #worker;
    constructor(worker){
        this.#queue = new Queue();
        this.#remain = new Uint8Array();
        this.#closed = false;
        this.#waiter = deferred1();
        this.#worker = worker;
        this.#worker.onmessage = (e)=>{
            if (this.#queue && !this.#closed) {
                this.#queue.put_nowait(e.data);
            }
        };
    }
    async read(p) {
        if (this.#remain.length) {
            return this.readFromRemain(p);
        }
        if (!this.#queue || this.#closed && this.#queue.empty()) {
            this.#queue = undefined;
            return null;
        }
        if (!this.#queue?.empty()) {
            this.#remain = this.#queue.get_nowait();
            return this.readFromRemain(p);
        }
        const r = await Promise.race([
            this.#queue.get(),
            this.#waiter
        ]);
        if (r == undefined) {
            return await this.read(p);
        }
        this.#remain = r;
        return this.readFromRemain(p);
    }
    readFromRemain(p) {
        const n = p.byteLength;
        const d = this.#remain.subarray(0, n);
        this.#remain = this.#remain.subarray(n);
        p.set(d);
        return d.byteLength;
    }
    close() {
        this.#closed = true;
        this.#waiter.resolve();
    }
}
const supportTransfer = compareVersions(Deno.version.deno, "1.14.0") >= 0;
class WorkerWriter {
    #worker;
    constructor(worker){
        this.#worker = worker;
    }
    write(p) {
        if (supportTransfer) {
            const c = new Uint8Array(p);
            this.#worker.postMessage(c, [
                c.buffer
            ]);
        } else {
            this.#worker.postMessage(p);
        }
        return Promise.resolve(p.length);
    }
}
function utf8Count(str) {
    const strLength = str.length;
    let byteLength = 0;
    let pos = 0;
    while(pos < strLength){
        let value = str.charCodeAt(pos++);
        if ((value & 4294967168) === 0) {
            byteLength++;
            continue;
        } else if ((value & 4294965248) === 0) {
            byteLength += 2;
        } else {
            if (value >= 55296 && value <= 56319) {
                if (pos < strLength) {
                    const extra = str.charCodeAt(pos);
                    if ((extra & 64512) === 56320) {
                        ++pos;
                        value = ((value & 1023) << 10) + (extra & 1023) + 65536;
                    }
                }
            }
            if ((value & 4294901760) === 0) {
                byteLength += 3;
            } else {
                byteLength += 4;
            }
        }
    }
    return byteLength;
}
function utf8EncodeJs(str, output, outputOffset) {
    const strLength = str.length;
    let offset = outputOffset;
    let pos = 0;
    while(pos < strLength){
        let value = str.charCodeAt(pos++);
        if ((value & 4294967168) === 0) {
            output[offset++] = value;
            continue;
        } else if ((value & 4294965248) === 0) {
            output[offset++] = value >> 6 & 31 | 192;
        } else {
            if (value >= 55296 && value <= 56319) {
                if (pos < strLength) {
                    const extra = str.charCodeAt(pos);
                    if ((extra & 64512) === 56320) {
                        ++pos;
                        value = ((value & 1023) << 10) + (extra & 1023) + 65536;
                    }
                }
            }
            if ((value & 4294901760) === 0) {
                output[offset++] = value >> 12 & 15 | 224;
                output[offset++] = value >> 6 & 63 | 128;
            } else {
                output[offset++] = value >> 18 & 7 | 240;
                output[offset++] = value >> 12 & 63 | 128;
                output[offset++] = value >> 6 & 63 | 128;
            }
        }
        output[offset++] = value & 63 | 128;
    }
}
const sharedTextEncoder = new TextEncoder();
function utf8EncodeTEencodeInto(str, output, outputOffset) {
    sharedTextEncoder.encodeInto(str, output.subarray(outputOffset));
}
const utf8EncodeTE = utf8EncodeTEencodeInto;
function utf8DecodeJs(bytes, inputOffset, byteLength) {
    let offset = inputOffset;
    const end = offset + byteLength;
    const units = [];
    let result = "";
    while(offset < end){
        const byte1 = bytes[offset++];
        if ((byte1 & 128) === 0) {
            units.push(byte1);
        } else if ((byte1 & 224) === 192) {
            const byte2 = bytes[offset++] & 63;
            units.push((byte1 & 31) << 6 | byte2);
        } else if ((byte1 & 240) === 224) {
            const byte2 = bytes[offset++] & 63;
            const byte3 = bytes[offset++] & 63;
            units.push((byte1 & 31) << 12 | byte2 << 6 | byte3);
        } else if ((byte1 & 248) === 240) {
            const byte2 = bytes[offset++] & 63;
            const byte3 = bytes[offset++] & 63;
            const byte4 = bytes[offset++] & 63;
            let unit = (byte1 & 7) << 18 | byte2 << 12 | byte3 << 6 | byte4;
            if (unit > 65535) {
                unit -= 65536;
                units.push(unit >>> 10 & 1023 | 55296);
                unit = 56320 | unit & 1023;
            }
            units.push(unit);
        } else {
            units.push(byte1);
        }
        if (units.length >= 4096) {
            result += String.fromCharCode(...units);
            units.length = 0;
        }
    }
    if (units.length > 0) {
        result += String.fromCharCode(...units);
    }
    return result;
}
const sharedTextDecoder = new TextDecoder();
function utf8DecodeTD(bytes, inputOffset, byteLength) {
    const stringBytes = bytes.subarray(inputOffset, inputOffset + byteLength);
    return sharedTextDecoder.decode(stringBytes);
}
class ExtData {
    type;
    data;
    constructor(type, data){
        this.type = type;
        this.data = data;
    }
}
function setUint64(view, offset, value) {
    const high = value / 4294967296;
    const low = value;
    view.setUint32(offset, high);
    view.setUint32(offset + 4, low);
}
function setInt64(view, offset, value) {
    const high = Math.floor(value / 4294967296);
    const low = value;
    view.setUint32(offset, high);
    view.setUint32(offset + 4, low);
}
function getInt64(view, offset) {
    const high = view.getInt32(offset);
    const low = view.getUint32(offset + 4);
    return high * 4294967296 + low;
}
function getUint64(view, offset) {
    const high = view.getUint32(offset);
    const low = view.getUint32(offset + 4);
    return high * 4294967296 + low;
}
const EXT_TIMESTAMP = -1;
const TIMESTAMP32_MAX_SEC = 4294967296 - 1;
const TIMESTAMP64_MAX_SEC = 17179869184 - 1;
function encodeTimeSpecToTimestamp({ sec , nsec  }) {
    if (sec >= 0 && nsec >= 0 && sec <= TIMESTAMP64_MAX_SEC) {
        if (nsec === 0 && sec <= TIMESTAMP32_MAX_SEC) {
            const rv = new Uint8Array(4);
            const view = new DataView(rv.buffer);
            view.setUint32(0, sec);
            return rv;
        } else {
            const secHigh = sec / 4294967296;
            const secLow = sec & 4294967295;
            const rv = new Uint8Array(8);
            const view = new DataView(rv.buffer);
            view.setUint32(0, nsec << 2 | secHigh & 3);
            view.setUint32(4, secLow);
            return rv;
        }
    } else {
        const rv = new Uint8Array(12);
        const view = new DataView(rv.buffer);
        view.setUint32(0, nsec);
        setInt64(view, 4, sec);
        return rv;
    }
}
function encodeDateToTimeSpec(date) {
    const msec = date.getTime();
    const sec = Math.floor(msec / 1000);
    const nsec = (msec - sec * 1000) * 1000000;
    const nsecInSec = Math.floor(nsec / 1000000000);
    return {
        sec: sec + nsecInSec,
        nsec: nsec - nsecInSec * 1000000000
    };
}
function encodeTimestampExtension(object) {
    if (object instanceof Date) {
        const timeSpec = encodeDateToTimeSpec(object);
        return encodeTimeSpecToTimestamp(timeSpec);
    } else {
        return null;
    }
}
function decodeTimestampToTimeSpec(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    switch(data.byteLength){
        case 4:
            {
                const sec = view.getUint32(0);
                return {
                    sec,
                    nsec: 0
                };
            }
        case 8:
            {
                const nsec30AndSecHigh2 = view.getUint32(0);
                const secLow32 = view.getUint32(4);
                const sec = (nsec30AndSecHigh2 & 3) * 4294967296 + secLow32;
                const nsec = nsec30AndSecHigh2 >>> 2;
                return {
                    sec,
                    nsec
                };
            }
        case 12:
            {
                const sec = getInt64(view, 4);
                const nsec = view.getUint32(0);
                return {
                    sec,
                    nsec
                };
            }
        default:
            throw new Error(`Unrecognized data size for timestamp: ${data.length}`);
    }
}
function decodeTimestampExtension(data) {
    const timeSpec = decodeTimestampToTimeSpec(data);
    return new Date(timeSpec.sec * 1000 + timeSpec.nsec / 1000000);
}
const timestampExtension = {
    type: EXT_TIMESTAMP,
    encode: encodeTimestampExtension,
    decode: decodeTimestampExtension
};
class ExtensionCodec {
    static defaultCodec = new ExtensionCodec();
    __brand;
    builtInEncoders = [];
    builtInDecoders = [];
    encoders = [];
    decoders = [];
    constructor(){
        this.register(timestampExtension);
    }
    register({ type , encode , decode  }) {
        if (type >= 0) {
            this.encoders[type] = encode;
            this.decoders[type] = decode;
        } else {
            const index = 1 + type;
            this.builtInEncoders[index] = encode;
            this.builtInDecoders[index] = decode;
        }
    }
    tryToEncode(object, context) {
        for(let i = 0; i < this.builtInEncoders.length; i++){
            const encoder = this.builtInEncoders[i];
            if (encoder != null) {
                const data = encoder(object, context);
                if (data != null) {
                    const type = -1 - i;
                    return new ExtData(type, data);
                }
            }
        }
        for(let i1 = 0; i1 < this.encoders.length; i1++){
            const encoder = this.encoders[i1];
            if (encoder != null) {
                const data = encoder(object, context);
                if (data != null) {
                    const type = i1;
                    return new ExtData(type, data);
                }
            }
        }
        if (object instanceof ExtData) {
            return object;
        }
        return null;
    }
    decode(data, type, context) {
        const decoder = type < 0 ? this.builtInDecoders[-1 - type] : this.decoders[type];
        if (decoder) {
            return decoder(data, type, context);
        } else {
            return new ExtData(type, data);
        }
    }
}
function ensureUint8Array(buffer) {
    if (buffer instanceof Uint8Array) {
        return buffer;
    } else if (ArrayBuffer.isView(buffer)) {
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else if (buffer instanceof ArrayBuffer) {
        return new Uint8Array(buffer);
    } else {
        return Uint8Array.from(buffer);
    }
}
function createDataView(buffer) {
    if (buffer instanceof ArrayBuffer) {
        return new DataView(buffer);
    }
    const bufferView = ensureUint8Array(buffer);
    return new DataView(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);
}
class Encoder {
    extensionCodec;
    context;
    maxDepth;
    initialBufferSize;
    sortKeys;
    forceFloat32;
    ignoreUndefined;
    pos = 0;
    view;
    bytes;
    constructor(extensionCodec = ExtensionCodec.defaultCodec, context = undefined, maxDepth = 100, initialBufferSize = 2048, sortKeys = false, forceFloat32 = false, ignoreUndefined = false){
        this.extensionCodec = extensionCodec;
        this.context = context;
        this.maxDepth = maxDepth;
        this.initialBufferSize = initialBufferSize;
        this.sortKeys = sortKeys;
        this.forceFloat32 = forceFloat32;
        this.ignoreUndefined = ignoreUndefined;
        this.view = new DataView(new ArrayBuffer(this.initialBufferSize));
        this.bytes = new Uint8Array(this.view.buffer);
    }
    getUint8Array() {
        return this.bytes.subarray(0, this.pos);
    }
    reinitializeState() {
        this.pos = 0;
    }
    encode(object) {
        this.reinitializeState();
        this.doEncode(object, 1);
        return this.getUint8Array();
    }
    doEncode(object, depth) {
        if (depth > this.maxDepth) {
            throw new Error(`Too deep objects in depth ${depth}`);
        }
        if (object == null) {
            this.encodeNil();
        } else if (typeof object === "boolean") {
            this.encodeBoolean(object);
        } else if (typeof object === "number") {
            this.encodeNumber(object);
        } else if (typeof object === "string") {
            this.encodeString(object);
        } else {
            this.encodeObject(object, depth);
        }
    }
    ensureBufferSizeToWrite(sizeToWrite) {
        const requiredSize = this.pos + sizeToWrite;
        if (this.view.byteLength < requiredSize) {
            this.resizeBuffer(requiredSize * 2);
        }
    }
    resizeBuffer(newSize) {
        const newBuffer = new ArrayBuffer(newSize);
        const newBytes = new Uint8Array(newBuffer);
        const newView = new DataView(newBuffer);
        newBytes.set(this.bytes);
        this.view = newView;
        this.bytes = newBytes;
    }
    encodeNil() {
        this.writeU8(192);
    }
    encodeBoolean(object) {
        if (object === false) {
            this.writeU8(194);
        } else {
            this.writeU8(195);
        }
    }
    encodeNumber(object) {
        if (Number.isSafeInteger(object)) {
            if (object >= 0) {
                if (object < 128) {
                    this.writeU8(object);
                } else if (object < 256) {
                    this.writeU8(204);
                    this.writeU8(object);
                } else if (object < 65536) {
                    this.writeU8(205);
                    this.writeU16(object);
                } else if (object < 4294967296) {
                    this.writeU8(206);
                    this.writeU32(object);
                } else {
                    this.writeU8(207);
                    this.writeU64(object);
                }
            } else {
                if (object >= -32) {
                    this.writeU8(224 | object + 32);
                } else if (object >= -128) {
                    this.writeU8(208);
                    this.writeI8(object);
                } else if (object >= -32768) {
                    this.writeU8(209);
                    this.writeI16(object);
                } else if (object >= -2147483648) {
                    this.writeU8(210);
                    this.writeI32(object);
                } else {
                    this.writeU8(211);
                    this.writeI64(object);
                }
            }
        } else {
            if (this.forceFloat32) {
                this.writeU8(202);
                this.writeF32(object);
            } else {
                this.writeU8(203);
                this.writeF64(object);
            }
        }
    }
    writeStringHeader(byteLength) {
        if (byteLength < 32) {
            this.writeU8(160 + byteLength);
        } else if (byteLength < 256) {
            this.writeU8(217);
            this.writeU8(byteLength);
        } else if (byteLength < 65536) {
            this.writeU8(218);
            this.writeU16(byteLength);
        } else if (byteLength < 4294967296) {
            this.writeU8(219);
            this.writeU32(byteLength);
        } else {
            throw new Error(`Too long string: ${byteLength} bytes in UTF-8`);
        }
    }
    encodeString(object) {
        const maxHeaderSize = 1 + 4;
        const strLength = object.length;
        if (strLength > 200) {
            const byteLength = utf8Count(object);
            this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
            this.writeStringHeader(byteLength);
            utf8EncodeTE(object, this.bytes, this.pos);
            this.pos += byteLength;
        } else {
            const byteLength = utf8Count(object);
            this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
            this.writeStringHeader(byteLength);
            utf8EncodeJs(object, this.bytes, this.pos);
            this.pos += byteLength;
        }
    }
    encodeObject(object, depth) {
        const ext = this.extensionCodec.tryToEncode(object, this.context);
        if (ext != null) {
            this.encodeExtension(ext);
        } else if (Array.isArray(object)) {
            this.encodeArray(object, depth);
        } else if (ArrayBuffer.isView(object)) {
            this.encodeBinary(object);
        } else if (typeof object === "object") {
            this.encodeMap(object, depth);
        } else {
            throw new Error(`Unrecognized object: ${Object.prototype.toString.apply(object)}`);
        }
    }
    encodeBinary(object) {
        const size = object.byteLength;
        if (size < 256) {
            this.writeU8(196);
            this.writeU8(size);
        } else if (size < 65536) {
            this.writeU8(197);
            this.writeU16(size);
        } else if (size < 4294967296) {
            this.writeU8(198);
            this.writeU32(size);
        } else {
            throw new Error(`Too large binary: ${size}`);
        }
        const bytes = ensureUint8Array(object);
        this.writeU8a(bytes);
    }
    encodeArray(object, depth) {
        const size = object.length;
        if (size < 16) {
            this.writeU8(144 + size);
        } else if (size < 65536) {
            this.writeU8(220);
            this.writeU16(size);
        } else if (size < 4294967296) {
            this.writeU8(221);
            this.writeU32(size);
        } else {
            throw new Error(`Too large array: ${size}`);
        }
        for (const item of object){
            this.doEncode(item, depth + 1);
        }
    }
    countWithoutUndefined(object, keys) {
        let count = 0;
        for (const key of keys){
            if (object[key] !== undefined) {
                count++;
            }
        }
        return count;
    }
    encodeMap(object, depth) {
        const keys = Object.keys(object);
        if (this.sortKeys) {
            keys.sort();
        }
        const size = this.ignoreUndefined ? this.countWithoutUndefined(object, keys) : keys.length;
        if (size < 16) {
            this.writeU8(128 + size);
        } else if (size < 65536) {
            this.writeU8(222);
            this.writeU16(size);
        } else if (size < 4294967296) {
            this.writeU8(223);
            this.writeU32(size);
        } else {
            throw new Error(`Too large map object: ${size}`);
        }
        for (const key of keys){
            const value = object[key];
            if (!(this.ignoreUndefined && value === undefined)) {
                this.encodeString(key);
                this.doEncode(value, depth + 1);
            }
        }
    }
    encodeExtension(ext) {
        const size = ext.data.length;
        if (size === 1) {
            this.writeU8(212);
        } else if (size === 2) {
            this.writeU8(213);
        } else if (size === 4) {
            this.writeU8(214);
        } else if (size === 8) {
            this.writeU8(215);
        } else if (size === 16) {
            this.writeU8(216);
        } else if (size < 256) {
            this.writeU8(199);
            this.writeU8(size);
        } else if (size < 65536) {
            this.writeU8(200);
            this.writeU16(size);
        } else if (size < 4294967296) {
            this.writeU8(201);
            this.writeU32(size);
        } else {
            throw new Error(`Too large extension object: ${size}`);
        }
        this.writeI8(ext.type);
        this.writeU8a(ext.data);
    }
    writeU8(value) {
        this.ensureBufferSizeToWrite(1);
        this.view.setUint8(this.pos, value);
        this.pos++;
    }
    writeU8a(values) {
        const size = values.length;
        this.ensureBufferSizeToWrite(size);
        this.bytes.set(values, this.pos);
        this.pos += size;
    }
    writeI8(value) {
        this.ensureBufferSizeToWrite(1);
        this.view.setInt8(this.pos, value);
        this.pos++;
    }
    writeU16(value) {
        this.ensureBufferSizeToWrite(2);
        this.view.setUint16(this.pos, value);
        this.pos += 2;
    }
    writeI16(value) {
        this.ensureBufferSizeToWrite(2);
        this.view.setInt16(this.pos, value);
        this.pos += 2;
    }
    writeU32(value) {
        this.ensureBufferSizeToWrite(4);
        this.view.setUint32(this.pos, value);
        this.pos += 4;
    }
    writeI32(value) {
        this.ensureBufferSizeToWrite(4);
        this.view.setInt32(this.pos, value);
        this.pos += 4;
    }
    writeF32(value) {
        this.ensureBufferSizeToWrite(4);
        this.view.setFloat32(this.pos, value);
        this.pos += 4;
    }
    writeF64(value) {
        this.ensureBufferSizeToWrite(8);
        this.view.setFloat64(this.pos, value);
        this.pos += 8;
    }
    writeU64(value) {
        this.ensureBufferSizeToWrite(8);
        setUint64(this.view, this.pos, value);
        this.pos += 8;
    }
    writeI64(value) {
        this.ensureBufferSizeToWrite(8);
        setInt64(this.view, this.pos, value);
        this.pos += 8;
    }
}
const defaultEncodeOptions = {
};
function encode1(value, options = defaultEncodeOptions) {
    const encoder = new Encoder(options.extensionCodec, options.context, options.maxDepth, options.initialBufferSize, options.sortKeys, options.forceFloat32, options.ignoreUndefined);
    return encoder.encode(value);
}
function prettyByte(__byte) {
    return `${__byte < 0 ? "-" : ""}0x${Math.abs(__byte).toString(16).padStart(2, "0")}`;
}
class CachedKeyDecoder {
    maxKeyLength;
    maxLengthPerKey;
    hit = 0;
    miss = 0;
    caches;
    constructor(maxKeyLength = 16, maxLengthPerKey = 16){
        this.maxKeyLength = maxKeyLength;
        this.maxLengthPerKey = maxLengthPerKey;
        this.caches = [];
        for(let i = 0; i < this.maxKeyLength; i++){
            this.caches.push([]);
        }
    }
    canBeCached(byteLength) {
        return byteLength > 0 && byteLength <= this.maxKeyLength;
    }
    get(bytes, inputOffset, byteLength) {
        const records = this.caches[byteLength - 1];
        const recordsLength = records.length;
        FIND_CHUNK: for(let i = 0; i < recordsLength; i++){
            const record = records[i];
            const recordBytes = record.bytes;
            for(let j = 0; j < byteLength; j++){
                if (recordBytes[j] !== bytes[inputOffset + j]) {
                    continue FIND_CHUNK;
                }
            }
            return record.value;
        }
        return null;
    }
    store(bytes, value) {
        const records = this.caches[bytes.length - 1];
        const record = {
            bytes,
            value
        };
        if (records.length >= this.maxLengthPerKey) {
            records[Math.random() * records.length | 0] = record;
        } else {
            records.push(record);
        }
    }
    decode(bytes, inputOffset, byteLength) {
        const cachedValue = this.get(bytes, inputOffset, byteLength);
        if (cachedValue != null) {
            this.hit++;
            return cachedValue;
        }
        this.miss++;
        const value = utf8DecodeJs(bytes, inputOffset, byteLength);
        const slicedCopyOfBytes = Uint8Array.prototype.slice.call(bytes, inputOffset, inputOffset + byteLength);
        this.store(slicedCopyOfBytes, value);
        return value;
    }
}
var State;
(function(State) {
    State[State["ARRAY"] = 0] = "ARRAY";
    State[State["MAP_KEY"] = 1] = "MAP_KEY";
    State[State["MAP_VALUE"] = 2] = "MAP_VALUE";
})(State || (State = {
}));
const isValidMapKeyType = (key)=>{
    const keyType = typeof key;
    return keyType === "string" || keyType === "number";
};
const HEAD_BYTE_REQUIRED = -1;
const EMPTY_VIEW = new DataView(new ArrayBuffer(0));
const EMPTY_BYTES = new Uint8Array(EMPTY_VIEW.buffer);
const DataViewIndexOutOfBoundsError = (()=>{
    try {
        EMPTY_VIEW.getInt8(0);
    } catch (e) {
        return e.constructor;
    }
    throw new Error("never reached");
})();
const MORE_DATA = new DataViewIndexOutOfBoundsError("Insufficient data");
const sharedCachedKeyDecoder = new CachedKeyDecoder();
class Decoder {
    extensionCodec;
    context;
    maxStrLength;
    maxBinLength;
    maxArrayLength;
    maxMapLength;
    maxExtLength;
    keyDecoder;
    totalPos = 0;
    pos = 0;
    view = EMPTY_VIEW;
    bytes = EMPTY_BYTES;
    headByte = HEAD_BYTE_REQUIRED;
    stack = [];
    constructor(extensionCodec = ExtensionCodec.defaultCodec, context = undefined, maxStrLength = 4294967295, maxBinLength = 4294967295, maxArrayLength = 4294967295, maxMapLength = 4294967295, maxExtLength = 4294967295, keyDecoder = sharedCachedKeyDecoder){
        this.extensionCodec = extensionCodec;
        this.context = context;
        this.maxStrLength = maxStrLength;
        this.maxBinLength = maxBinLength;
        this.maxArrayLength = maxArrayLength;
        this.maxMapLength = maxMapLength;
        this.maxExtLength = maxExtLength;
        this.keyDecoder = keyDecoder;
    }
    reinitializeState() {
        this.totalPos = 0;
        this.headByte = HEAD_BYTE_REQUIRED;
    }
    setBuffer(buffer) {
        this.bytes = ensureUint8Array(buffer);
        this.view = createDataView(this.bytes);
        this.pos = 0;
    }
    appendBuffer(buffer) {
        buffer = ensureUint8Array(buffer).slice();
        if (this.headByte === HEAD_BYTE_REQUIRED && !this.hasRemaining()) {
            this.setBuffer(buffer);
        } else {
            const remainingData = this.bytes.subarray(this.pos);
            const newData = ensureUint8Array(buffer);
            const concated = new Uint8Array(remainingData.length + newData.length);
            concated.set(remainingData);
            concated.set(newData, remainingData.length);
            this.setBuffer(concated);
        }
    }
    hasRemaining(size = 1) {
        return this.view.byteLength - this.pos >= size;
    }
    createNoExtraBytesError(posToShow) {
        const { view , pos  } = this;
        return new RangeError(`Extra ${view.byteLength - pos} of ${view.byteLength} byte(s) found at buffer[${posToShow}]`);
    }
    decode(buffer) {
        this.reinitializeState();
        this.setBuffer(buffer);
        return this.doDecodeSingleSync();
    }
    doDecodeSingleSync() {
        const object = this.doDecodeSync();
        if (this.hasRemaining()) {
            throw this.createNoExtraBytesError(this.pos);
        }
        return object;
    }
    async decodeAsync(stream) {
        let decoded = false;
        let object;
        for await (const buffer of stream){
            if (decoded) {
                throw this.createNoExtraBytesError(this.totalPos);
            }
            this.appendBuffer(buffer);
            try {
                object = this.doDecodeSync();
                decoded = true;
            } catch (e) {
                if (!(e instanceof DataViewIndexOutOfBoundsError)) {
                    throw e;
                }
            }
            this.totalPos += this.pos;
        }
        if (decoded) {
            if (this.hasRemaining()) {
                throw this.createNoExtraBytesError(this.totalPos);
            }
            return object;
        }
        const { headByte , pos , totalPos  } = this;
        throw new RangeError(`Insufficient data in parcing ${prettyByte(headByte)} at ${totalPos} (${pos} in the current buffer)`);
    }
    decodeArrayStream(stream) {
        return this.decodeMultiAsync(stream, true);
    }
    decodeStream(stream) {
        return this.decodeMultiAsync(stream, false);
    }
    async *decodeMultiAsync(stream, isArray) {
        let isArrayHeaderRequired = isArray;
        let arrayItemsLeft = -1;
        for await (const buffer of stream){
            if (isArray && arrayItemsLeft === 0) {
                throw this.createNoExtraBytesError(this.totalPos);
            }
            this.appendBuffer(buffer);
            if (isArrayHeaderRequired) {
                arrayItemsLeft = this.readArraySize();
                isArrayHeaderRequired = false;
                this.complete();
            }
            try {
                while(true){
                    yield this.doDecodeSync();
                    if (--arrayItemsLeft === 0) {
                        break;
                    }
                }
            } catch (e) {
                if (!(e instanceof DataViewIndexOutOfBoundsError)) {
                    throw e;
                }
            }
            this.totalPos += this.pos;
        }
    }
    doDecodeSync() {
        DECODE: while(true){
            const headByte = this.readHeadByte();
            let object;
            if (headByte >= 224) {
                object = headByte - 256;
            } else if (headByte < 192) {
                if (headByte < 128) {
                    object = headByte;
                } else if (headByte < 144) {
                    const size = headByte - 128;
                    if (size !== 0) {
                        this.pushMapState(size);
                        this.complete();
                        continue DECODE;
                    } else {
                        object = {
                        };
                    }
                } else if (headByte < 160) {
                    const size = headByte - 144;
                    if (size !== 0) {
                        this.pushArrayState(size);
                        this.complete();
                        continue DECODE;
                    } else {
                        object = [];
                    }
                } else {
                    const byteLength = headByte - 160;
                    object = this.decodeUtf8String(byteLength, 0);
                }
            } else if (headByte === 192) {
                object = null;
            } else if (headByte === 194) {
                object = false;
            } else if (headByte === 195) {
                object = true;
            } else if (headByte === 202) {
                object = this.readF32();
            } else if (headByte === 203) {
                object = this.readF64();
            } else if (headByte === 204) {
                object = this.readU8();
            } else if (headByte === 205) {
                object = this.readU16();
            } else if (headByte === 206) {
                object = this.readU32();
            } else if (headByte === 207) {
                object = this.readU64();
            } else if (headByte === 208) {
                object = this.readI8();
            } else if (headByte === 209) {
                object = this.readI16();
            } else if (headByte === 210) {
                object = this.readI32();
            } else if (headByte === 211) {
                object = this.readI64();
            } else if (headByte === 217) {
                const byteLength = this.lookU8();
                object = this.decodeUtf8String(byteLength, 1);
            } else if (headByte === 218) {
                const byteLength = this.lookU16();
                object = this.decodeUtf8String(byteLength, 2);
            } else if (headByte === 219) {
                const byteLength = this.lookU32();
                object = this.decodeUtf8String(byteLength, 4);
            } else if (headByte === 220) {
                const size = this.readU16();
                if (size !== 0) {
                    this.pushArrayState(size);
                    this.complete();
                    continue DECODE;
                } else {
                    object = [];
                }
            } else if (headByte === 221) {
                const size = this.readU32();
                if (size !== 0) {
                    this.pushArrayState(size);
                    this.complete();
                    continue DECODE;
                } else {
                    object = [];
                }
            } else if (headByte === 222) {
                const size = this.readU16();
                if (size !== 0) {
                    this.pushMapState(size);
                    this.complete();
                    continue DECODE;
                } else {
                    object = {
                    };
                }
            } else if (headByte === 223) {
                const size = this.readU32();
                if (size !== 0) {
                    this.pushMapState(size);
                    this.complete();
                    continue DECODE;
                } else {
                    object = {
                    };
                }
            } else if (headByte === 196) {
                const size = this.lookU8();
                object = this.decodeBinary(size, 1);
            } else if (headByte === 197) {
                const size = this.lookU16();
                object = this.decodeBinary(size, 2);
            } else if (headByte === 198) {
                const size = this.lookU32();
                object = this.decodeBinary(size, 4);
            } else if (headByte === 212) {
                object = this.decodeExtension(1, 0);
            } else if (headByte === 213) {
                object = this.decodeExtension(2, 0);
            } else if (headByte === 214) {
                object = this.decodeExtension(4, 0);
            } else if (headByte === 215) {
                object = this.decodeExtension(8, 0);
            } else if (headByte === 216) {
                object = this.decodeExtension(16, 0);
            } else if (headByte === 199) {
                const size = this.lookU8();
                object = this.decodeExtension(size, 1);
            } else if (headByte === 200) {
                const size = this.lookU16();
                object = this.decodeExtension(size, 2);
            } else if (headByte === 201) {
                const size = this.lookU32();
                object = this.decodeExtension(size, 4);
            } else {
                throw new Error(`Unrecognized type byte: ${prettyByte(headByte)}`);
            }
            this.complete();
            const stack = this.stack;
            while(stack.length > 0){
                const state = stack[stack.length - 1];
                if (state.type === State.ARRAY) {
                    state.array[state.position] = object;
                    state.position++;
                    if (state.position === state.size) {
                        stack.pop();
                        object = state.array;
                    } else {
                        continue DECODE;
                    }
                } else if (state.type === State.MAP_KEY) {
                    if (!isValidMapKeyType(object)) {
                        throw new Error("The type of key must be string or number but " + typeof object);
                    }
                    state.key = object;
                    state.type = State.MAP_VALUE;
                    continue DECODE;
                } else {
                    state.map[state.key] = object;
                    state.readCount++;
                    if (state.readCount === state.size) {
                        stack.pop();
                        object = state.map;
                    } else {
                        state.key = null;
                        state.type = State.MAP_KEY;
                        continue DECODE;
                    }
                }
            }
            return object;
        }
    }
    readHeadByte() {
        if (this.headByte === HEAD_BYTE_REQUIRED) {
            this.headByte = this.readU8();
        }
        return this.headByte;
    }
    complete() {
        this.headByte = HEAD_BYTE_REQUIRED;
    }
    readArraySize() {
        const headByte = this.readHeadByte();
        switch(headByte){
            case 220:
                return this.readU16();
            case 221:
                return this.readU32();
            default:
                {
                    if (headByte < 160) {
                        return headByte - 144;
                    } else {
                        throw new Error(`Unrecognized array type byte: ${prettyByte(headByte)}`);
                    }
                }
        }
    }
    pushMapState(size) {
        if (size > this.maxMapLength) {
            throw new Error(`Max length exceeded: map length (${size}) > maxMapLengthLength (${this.maxMapLength})`);
        }
        this.stack.push({
            type: State.MAP_KEY,
            size,
            key: null,
            readCount: 0,
            map: {
            }
        });
    }
    pushArrayState(size) {
        if (size > this.maxArrayLength) {
            throw new Error(`Max length exceeded: array length (${size}) > maxArrayLength (${this.maxArrayLength})`);
        }
        this.stack.push({
            type: State.ARRAY,
            size,
            array: new Array(size),
            position: 0
        });
    }
    decodeUtf8String(byteLength, headerOffset) {
        if (byteLength > this.maxStrLength) {
            throw new Error(`Max length exceeded: UTF-8 byte length (${byteLength}) > maxStrLength (${this.maxStrLength})`);
        }
        if (this.bytes.byteLength < this.pos + headerOffset + byteLength) {
            throw MORE_DATA;
        }
        const offset = this.pos + headerOffset;
        let object;
        if (this.stateIsMapKey() && this.keyDecoder?.canBeCached(byteLength)) {
            object = this.keyDecoder.decode(this.bytes, offset, byteLength);
        } else if (byteLength > 200) {
            object = utf8DecodeTD(this.bytes, offset, byteLength);
        } else {
            object = utf8DecodeJs(this.bytes, offset, byteLength);
        }
        this.pos += headerOffset + byteLength;
        return object;
    }
    stateIsMapKey() {
        if (this.stack.length > 0) {
            const state = this.stack[this.stack.length - 1];
            return state.type === State.MAP_KEY;
        }
        return false;
    }
    decodeBinary(byteLength, headOffset) {
        if (byteLength > this.maxBinLength) {
            throw new Error(`Max length exceeded: bin length (${byteLength}) > maxBinLength (${this.maxBinLength})`);
        }
        if (!this.hasRemaining(byteLength + headOffset)) {
            throw MORE_DATA;
        }
        const offset = this.pos + headOffset;
        const object = this.bytes.subarray(offset, offset + byteLength);
        this.pos += headOffset + byteLength;
        return object;
    }
    decodeExtension(size, headOffset) {
        if (size > this.maxExtLength) {
            throw new Error(`Max length exceeded: ext length (${size}) > maxExtLength (${this.maxExtLength})`);
        }
        const extType = this.view.getInt8(this.pos + headOffset);
        const data = this.decodeBinary(size, headOffset + 1);
        return this.extensionCodec.decode(data, extType, this.context);
    }
    lookU8() {
        return this.view.getUint8(this.pos);
    }
    lookU16() {
        return this.view.getUint16(this.pos);
    }
    lookU32() {
        return this.view.getUint32(this.pos);
    }
    readU8() {
        const value = this.view.getUint8(this.pos);
        this.pos++;
        return value;
    }
    readI8() {
        const value = this.view.getInt8(this.pos);
        this.pos++;
        return value;
    }
    readU16() {
        const value = this.view.getUint16(this.pos);
        this.pos += 2;
        return value;
    }
    readI16() {
        const value = this.view.getInt16(this.pos);
        this.pos += 2;
        return value;
    }
    readU32() {
        const value = this.view.getUint32(this.pos);
        this.pos += 4;
        return value;
    }
    readI32() {
        const value = this.view.getInt32(this.pos);
        this.pos += 4;
        return value;
    }
    readU64() {
        const value = getUint64(this.view, this.pos);
        this.pos += 8;
        return value;
    }
    readI64() {
        const value = getInt64(this.view, this.pos);
        this.pos += 8;
        return value;
    }
    readF32() {
        const value = this.view.getFloat32(this.pos);
        this.pos += 4;
        return value;
    }
    readF64() {
        const value = this.view.getFloat64(this.pos);
        this.pos += 8;
        return value;
    }
}
const defaultDecodeOptions = {
};
function isAsyncIterable(object) {
    return object[Symbol.asyncIterator] != null;
}
function assertNonNull(value) {
    if (value == null) {
        throw new Error("Assertion Failure: value must not be null nor undefined");
    }
}
async function* asyncIterableFromStream(stream) {
    const reader = stream.getReader();
    try {
        while(true){
            const { done , value  } = await reader.read();
            if (done) {
                return;
            }
            assertNonNull(value);
            yield value;
        }
    } finally{
        reader.releaseLock();
    }
}
function ensureAsyncIterabe(streamLike) {
    if (isAsyncIterable(streamLike)) {
        return streamLike;
    } else {
        return asyncIterableFromStream(streamLike);
    }
}
function decodeStream(streamLike, options = defaultDecodeOptions) {
    const stream = ensureAsyncIterabe(streamLike);
    const decoder = new Decoder(options.extensionCodec, options.context, options.maxStrLength, options.maxBinLength, options.maxArrayLength, options.maxMapLength, options.maxExtLength);
    return decoder.decodeStream(stream);
}
function deferred2() {
    let methods;
    let state = "pending";
    const promise = new Promise((resolve, reject)=>{
        methods = {
            async resolve (value) {
                await value;
                state = "fulfilled";
                resolve(value);
            },
            reject (reason) {
                state = "rejected";
                reject(reason);
            }
        };
    });
    Object.defineProperty(promise, "state", {
        get: ()=>state
    });
    return Object.assign(promise, methods);
}
class DenoStdInternalError1 extends Error {
    constructor(message){
        super(message);
        this.name = "DenoStdInternalError";
    }
}
function assert1(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError1(msg);
    }
}
function concat(...buf) {
    let length = 0;
    for (const b of buf){
        length += b.length;
    }
    const output = new Uint8Array(length);
    let index = 0;
    for (const b1 of buf){
        output.set(b1, index);
        index += b1.length;
    }
    return output;
}
function copy(src, dst, off = 0) {
    off = Math.max(0, Math.min(off, dst.byteLength));
    const dstBytesAvailable = dst.byteLength - off;
    if (src.byteLength > dstBytesAvailable) {
        src = src.subarray(0, dstBytesAvailable);
    }
    dst.set(src, off);
    return src.byteLength;
}
const MIN_READ = 32 * 1024;
const MAX_SIZE = 2 ** 32 - 2;
class Buffer {
    #buf;
    #off = 0;
    constructor(ab){
        this.#buf = ab === undefined ? new Uint8Array(0) : new Uint8Array(ab);
    }
    bytes(options = {
        copy: true
    }) {
        if (options.copy === false) return this.#buf.subarray(this.#off);
        return this.#buf.slice(this.#off);
    }
    empty() {
        return this.#buf.byteLength <= this.#off;
    }
    get length() {
        return this.#buf.byteLength - this.#off;
    }
    get capacity() {
        return this.#buf.buffer.byteLength;
    }
    truncate(n) {
        if (n === 0) {
            this.reset();
            return;
        }
        if (n < 0 || n > this.length) {
            throw Error("bytes.Buffer: truncation out of range");
        }
        this.#reslice(this.#off + n);
    }
    reset() {
        this.#reslice(0);
        this.#off = 0;
    }
     #tryGrowByReslice(n) {
        const l = this.#buf.byteLength;
        if (n <= this.capacity - l) {
            this.#reslice(l + n);
            return l;
        }
        return -1;
    }
     #reslice(len) {
        assert1(len <= this.#buf.buffer.byteLength);
        this.#buf = new Uint8Array(this.#buf.buffer, 0, len);
    }
    readSync(p) {
        if (this.empty()) {
            this.reset();
            if (p.byteLength === 0) {
                return 0;
            }
            return null;
        }
        const nread = copy(this.#buf.subarray(this.#off), p);
        this.#off += nread;
        return nread;
    }
    read(p) {
        const rr = this.readSync(p);
        return Promise.resolve(rr);
    }
    writeSync(p) {
        const m = this.#grow(p.byteLength);
        return copy(p, this.#buf, m);
    }
    write(p) {
        const n = this.writeSync(p);
        return Promise.resolve(n);
    }
     #grow(n) {
        const m = this.length;
        if (m === 0 && this.#off !== 0) {
            this.reset();
        }
        const i = this.#tryGrowByReslice(n);
        if (i >= 0) {
            return i;
        }
        const c = this.capacity;
        if (n <= Math.floor(c / 2) - m) {
            copy(this.#buf.subarray(this.#off), this.#buf);
        } else if (c + n > MAX_SIZE) {
            throw new Error("The buffer cannot be grown beyond the maximum size.");
        } else {
            const buf = new Uint8Array(Math.min(2 * c + n, MAX_SIZE));
            copy(this.#buf.subarray(this.#off), buf);
            this.#buf = buf;
        }
        this.#off = 0;
        this.#reslice(Math.min(m + n, MAX_SIZE));
        return m;
    }
    grow(n) {
        if (n < 0) {
            throw Error("Buffer.grow: negative count");
        }
        const m = this.#grow(n);
        this.#reslice(m);
    }
    async readFrom(r) {
        let n = 0;
        const tmp = new Uint8Array(MIN_READ);
        while(true){
            const shouldGrow = this.capacity - this.length < MIN_READ;
            const buf = shouldGrow ? tmp : new Uint8Array(this.#buf.buffer, this.length);
            const nread = await r.read(buf);
            if (nread === null) {
                return n;
            }
            if (shouldGrow) this.writeSync(buf.subarray(0, nread));
            else this.#reslice(this.length + nread);
            n += nread;
        }
    }
    readFromSync(r) {
        let n = 0;
        const tmp = new Uint8Array(MIN_READ);
        while(true){
            const shouldGrow = this.capacity - this.length < MIN_READ;
            const buf = shouldGrow ? tmp : new Uint8Array(this.#buf.buffer, this.length);
            const nread = r.readSync(buf);
            if (nread === null) {
                return n;
            }
            if (shouldGrow) this.writeSync(buf.subarray(0, nread));
            else this.#reslice(this.length + nread);
            n += nread;
        }
    }
}
class BytesList {
    len = 0;
    chunks = [];
    constructor(){
    }
    size() {
        return this.len;
    }
    add(value, start = 0, end = value.byteLength) {
        if (value.byteLength === 0 || end - start === 0) {
            return;
        }
        checkRange(start, end, value.byteLength);
        this.chunks.push({
            value,
            end,
            start,
            offset: this.len
        });
        this.len += end - start;
    }
    shift(n) {
        if (n === 0) {
            return;
        }
        if (this.len <= n) {
            this.chunks = [];
            this.len = 0;
            return;
        }
        const idx = this.getChunkIndex(n);
        this.chunks.splice(0, idx);
        const [chunk] = this.chunks;
        if (chunk) {
            const diff = n - chunk.offset;
            chunk.start += diff;
        }
        let offset = 0;
        for (const chunk1 of this.chunks){
            chunk1.offset = offset;
            offset += chunk1.end - chunk1.start;
        }
        this.len = offset;
    }
    getChunkIndex(pos) {
        let max = this.chunks.length;
        let min = 0;
        while(true){
            const i = min + Math.floor((max - min) / 2);
            if (i < 0 || this.chunks.length <= i) {
                return -1;
            }
            const { offset , start , end  } = this.chunks[i];
            const len = end - start;
            if (offset <= pos && pos < offset + len) {
                return i;
            } else if (offset + len <= pos) {
                min = i + 1;
            } else {
                max = i - 1;
            }
        }
    }
    get(i) {
        if (i < 0 || this.len <= i) {
            throw new Error("out of range");
        }
        const idx = this.getChunkIndex(i);
        const { value , offset , start  } = this.chunks[idx];
        return value[start + i - offset];
    }
    *iterator(start = 0) {
        const startIdx = this.getChunkIndex(start);
        if (startIdx < 0) return;
        const first = this.chunks[startIdx];
        let firstOffset = start - first.offset;
        for(let i = startIdx; i < this.chunks.length; i++){
            const chunk = this.chunks[i];
            for(let j = chunk.start + firstOffset; j < chunk.end; j++){
                yield chunk.value[j];
            }
            firstOffset = 0;
        }
    }
    slice(start, end = this.len) {
        if (end === start) {
            return new Uint8Array();
        }
        checkRange(start, end, this.len);
        const result = new Uint8Array(end - start);
        const startIdx = this.getChunkIndex(start);
        const endIdx = this.getChunkIndex(end - 1);
        let written = 0;
        for(let i = startIdx; i < endIdx; i++){
            const chunk = this.chunks[i];
            const len = chunk.end - chunk.start;
            result.set(chunk.value.subarray(chunk.start, chunk.end), written);
            written += len;
        }
        const last = this.chunks[endIdx];
        const rest = end - start - written;
        result.set(last.value.subarray(last.start, last.start + rest), written);
        return result;
    }
    concat() {
        const result = new Uint8Array(this.len);
        let sum = 0;
        for (const { value , start , end  } of this.chunks){
            result.set(value.subarray(start, end), sum);
            sum += end - start;
        }
        return result;
    }
}
function checkRange(start, end, len) {
    if (start < 0 || len < start || end < 0 || len < end || end < start) {
        throw new Error("invalid range");
    }
}
const { Deno: Deno1  } = globalThis;
typeof Deno1?.noColor === "boolean" ? Deno1.noColor : true;
new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))", 
].join("|"), "g");
var DiffType;
(function(DiffType) {
    DiffType["removed"] = "removed";
    DiffType["common"] = "common";
    DiffType["added"] = "added";
})(DiffType || (DiffType = {
}));
class AssertionError extends Error {
    name = "AssertionError";
    constructor(message){
        super(message);
    }
}
function assert2(expr, msg = "") {
    if (!expr) {
        throw new AssertionError(msg);
    }
}
const DEFAULT_BUFFER_SIZE = 32 * 1024;
async function readAll(r) {
    const buf = new Buffer();
    await buf.readFrom(r);
    return buf.bytes();
}
function readAllSync(r) {
    const buf = new Buffer();
    buf.readFromSync(r);
    return buf.bytes();
}
async function readRange(r, range) {
    let length = range.end - range.start + 1;
    assert2(length > 0, "Invalid byte range was passed.");
    await r.seek(range.start, Deno.SeekMode.Start);
    const result = new Uint8Array(length);
    let off = 0;
    while(length){
        const p = new Uint8Array(Math.min(length, DEFAULT_BUFFER_SIZE));
        const nread = await r.read(p);
        assert2(nread !== null, "Unexpected EOF reach while reading a range.");
        assert2(nread > 0, "Unexpected read of 0 bytes while reading a range.");
        copy(p, result, off);
        off += nread;
        length -= nread;
        assert2(length >= 0, "Unexpected length remaining after reading range.");
    }
    return result;
}
function readRangeSync(r, range) {
    let length = range.end - range.start + 1;
    assert2(length > 0, "Invalid byte range was passed.");
    r.seekSync(range.start, Deno.SeekMode.Start);
    const result = new Uint8Array(length);
    let off = 0;
    while(length){
        const p = new Uint8Array(Math.min(length, DEFAULT_BUFFER_SIZE));
        const nread = r.readSync(p);
        assert2(nread !== null, "Unexpected EOF reach while reading a range.");
        assert2(nread > 0, "Unexpected read of 0 bytes while reading a range.");
        copy(p, result, off);
        off += nread;
        length -= nread;
        assert2(length >= 0, "Unexpected length remaining after reading range.");
    }
    return result;
}
async function writeAll(w, arr) {
    let nwritten = 0;
    while(nwritten < arr.length){
        nwritten += await w.write(arr.subarray(nwritten));
    }
}
function writeAllSync(w, arr) {
    let nwritten = 0;
    while(nwritten < arr.length){
        nwritten += w.writeSync(arr.subarray(nwritten));
    }
}
async function* iter(r, options) {
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE;
    const b = new Uint8Array(bufSize);
    while(true){
        const result = await r.read(b);
        if (result === null) {
            break;
        }
        yield b.subarray(0, result);
    }
}
function* iterSync(r, options) {
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE;
    const b = new Uint8Array(bufSize);
    while(true){
        const result = r.readSync(b);
        if (result === null) {
            break;
        }
        yield b.subarray(0, result);
    }
}
async function copy1(src, dst, options) {
    let n = 0;
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE;
    const b = new Uint8Array(bufSize);
    let gotEOF = false;
    while(gotEOF === false){
        const result = await src.read(b);
        if (result === null) {
            gotEOF = true;
        } else {
            let nwritten = 0;
            while(nwritten < result){
                nwritten += await dst.write(b.subarray(nwritten, result));
            }
            n += nwritten;
        }
    }
    return n;
}
const DEFAULT_BUF_SIZE = 4096;
const MIN_BUF_SIZE = 16;
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);
class BufferFullError extends Error {
    partial;
    name = "BufferFullError";
    constructor(partial){
        super("Buffer full");
        this.partial = partial;
    }
}
class PartialReadError extends Error {
    name = "PartialReadError";
    partial;
    constructor(){
        super("Encountered UnexpectedEof, data only partially read");
    }
}
class BufReader {
    buf;
    rd;
    r = 0;
    w = 0;
    eof = false;
    static create(r, size = 4096) {
        return r instanceof BufReader ? r : new BufReader(r, size);
    }
    constructor(rd, size = 4096){
        if (size < 16) {
            size = MIN_BUF_SIZE;
        }
        this._reset(new Uint8Array(size), rd);
    }
    size() {
        return this.buf.byteLength;
    }
    buffered() {
        return this.w - this.r;
    }
    async _fill() {
        if (this.r > 0) {
            this.buf.copyWithin(0, this.r, this.w);
            this.w -= this.r;
            this.r = 0;
        }
        if (this.w >= this.buf.byteLength) {
            throw Error("bufio: tried to fill full buffer");
        }
        for(let i = 100; i > 0; i--){
            const rr = await this.rd.read(this.buf.subarray(this.w));
            if (rr === null) {
                this.eof = true;
                return;
            }
            assert1(rr >= 0, "negative read");
            this.w += rr;
            if (rr > 0) {
                return;
            }
        }
        throw new Error(`No progress after ${100} read() calls`);
    }
    reset(r) {
        this._reset(this.buf, r);
    }
    _reset(buf, rd) {
        this.buf = buf;
        this.rd = rd;
        this.eof = false;
    }
    async read(p) {
        let rr = p.byteLength;
        if (p.byteLength === 0) return rr;
        if (this.r === this.w) {
            if (p.byteLength >= this.buf.byteLength) {
                const rr = await this.rd.read(p);
                const nread = rr ?? 0;
                assert1(nread >= 0, "negative read");
                return rr;
            }
            this.r = 0;
            this.w = 0;
            rr = await this.rd.read(this.buf);
            if (rr === 0 || rr === null) return rr;
            assert1(rr >= 0, "negative read");
            this.w += rr;
        }
        const copied = copy(this.buf.subarray(this.r, this.w), p, 0);
        this.r += copied;
        return copied;
    }
    async readFull(p) {
        let bytesRead = 0;
        while(bytesRead < p.length){
            try {
                const rr = await this.read(p.subarray(bytesRead));
                if (rr === null) {
                    if (bytesRead === 0) {
                        return null;
                    } else {
                        throw new PartialReadError();
                    }
                }
                bytesRead += rr;
            } catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = p.subarray(0, bytesRead);
                } else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = p.subarray(0, bytesRead);
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
        }
        return p;
    }
    async readByte() {
        while(this.r === this.w){
            if (this.eof) return null;
            await this._fill();
        }
        const c = this.buf[this.r];
        this.r++;
        return c;
    }
    async readString(delim) {
        if (delim.length !== 1) {
            throw new Error("Delimiter should be a single character");
        }
        const buffer = await this.readSlice(delim.charCodeAt(0));
        if (buffer === null) return null;
        return new TextDecoder().decode(buffer);
    }
    async readLine() {
        let line = null;
        try {
            line = await this.readSlice(LF);
        } catch (err) {
            if (err instanceof Deno.errors.BadResource) {
                throw err;
            }
            let partial;
            if (err instanceof PartialReadError) {
                partial = err.partial;
                assert1(partial instanceof Uint8Array, "bufio: caught error from `readSlice()` without `partial` property");
            }
            if (!(err instanceof BufferFullError)) {
                throw err;
            }
            if (!this.eof && partial && partial.byteLength > 0 && partial[partial.byteLength - 1] === CR) {
                assert1(this.r > 0, "bufio: tried to rewind past start of buffer");
                this.r--;
                partial = partial.subarray(0, partial.byteLength - 1);
            }
            if (partial) {
                return {
                    line: partial,
                    more: !this.eof
                };
            }
        }
        if (line === null) {
            return null;
        }
        if (line.byteLength === 0) {
            return {
                line,
                more: false
            };
        }
        if (line[line.byteLength - 1] == LF) {
            let drop = 1;
            if (line.byteLength > 1 && line[line.byteLength - 2] === CR) {
                drop = 2;
            }
            line = line.subarray(0, line.byteLength - drop);
        }
        return {
            line,
            more: false
        };
    }
    async readSlice(delim) {
        let s = 0;
        let slice;
        while(true){
            let i = this.buf.subarray(this.r + s, this.w).indexOf(delim);
            if (i >= 0) {
                i += s;
                slice = this.buf.subarray(this.r, this.r + i + 1);
                this.r += i + 1;
                break;
            }
            if (this.eof) {
                if (this.r === this.w) {
                    return null;
                }
                slice = this.buf.subarray(this.r, this.w);
                this.r = this.w;
                break;
            }
            if (this.buffered() >= this.buf.byteLength) {
                this.r = this.w;
                const oldbuf = this.buf;
                const newbuf = this.buf.slice(0);
                this.buf = newbuf;
                throw new BufferFullError(oldbuf);
            }
            s = this.w - this.r;
            try {
                await this._fill();
            } catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = slice;
                } else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = slice;
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
        }
        return slice;
    }
    async peek(n) {
        if (n < 0) {
            throw Error("negative count");
        }
        let avail = this.w - this.r;
        while(avail < n && avail < this.buf.byteLength && !this.eof){
            try {
                await this._fill();
            } catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = this.buf.subarray(this.r, this.w);
                } else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = this.buf.subarray(this.r, this.w);
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
            avail = this.w - this.r;
        }
        if (avail === 0 && this.eof) {
            return null;
        } else if (avail < n && this.eof) {
            return this.buf.subarray(this.r, this.r + avail);
        } else if (avail < n) {
            throw new BufferFullError(this.buf.subarray(this.r, this.w));
        }
        return this.buf.subarray(this.r, this.r + n);
    }
}
class AbstractBufBase {
    buf;
    usedBufferBytes = 0;
    err = null;
    size() {
        return this.buf.byteLength;
    }
    available() {
        return this.buf.byteLength - this.usedBufferBytes;
    }
    buffered() {
        return this.usedBufferBytes;
    }
}
class BufWriter extends AbstractBufBase {
    writer;
    static create(writer, size = 4096) {
        return writer instanceof BufWriter ? writer : new BufWriter(writer, size);
    }
    constructor(writer, size = 4096){
        super();
        this.writer = writer;
        if (size <= 0) {
            size = DEFAULT_BUF_SIZE;
        }
        this.buf = new Uint8Array(size);
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.writer = w;
    }
    async flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            await writeAll(this.writer, this.buf.subarray(0, this.usedBufferBytes));
        } catch (e) {
            if (e instanceof Error) {
                this.err = e;
            }
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    async write(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = await this.writer.write(data);
                } catch (e) {
                    if (e instanceof Error) {
                        this.err = e;
                    }
                    throw e;
                }
            } else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                await this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
class BufWriterSync extends AbstractBufBase {
    writer;
    static create(writer, size = 4096) {
        return writer instanceof BufWriterSync ? writer : new BufWriterSync(writer, size);
    }
    constructor(writer, size = 4096){
        super();
        this.writer = writer;
        if (size <= 0) {
            size = DEFAULT_BUF_SIZE;
        }
        this.buf = new Uint8Array(size);
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.writer = w;
    }
    flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            writeAllSync(this.writer, this.buf.subarray(0, this.usedBufferBytes));
        } catch (e) {
            if (e instanceof Error) {
                this.err = e;
            }
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    writeSync(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = this.writer.writeSync(data);
                } catch (e) {
                    if (e instanceof Error) {
                        this.err = e;
                    }
                    throw e;
                }
            } else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
function createLPS(pat) {
    const lps = new Uint8Array(pat.length);
    lps[0] = 0;
    let prefixEnd = 0;
    let i = 1;
    while(i < lps.length){
        if (pat[i] == pat[prefixEnd]) {
            prefixEnd++;
            lps[i] = prefixEnd;
            i++;
        } else if (prefixEnd === 0) {
            lps[i] = 0;
            i++;
        } else {
            prefixEnd = lps[prefixEnd - 1];
        }
    }
    return lps;
}
async function* readDelim(reader, delim) {
    const delimLen = delim.length;
    const delimLPS = createLPS(delim);
    const chunks = new BytesList();
    const bufSize = Math.max(1024, delimLen + 1);
    let inspectIndex = 0;
    let matchIndex = 0;
    while(true){
        const inspectArr = new Uint8Array(bufSize);
        const result = await reader.read(inspectArr);
        if (result === null) {
            yield chunks.concat();
            return;
        } else if (result < 0) {
            return;
        }
        chunks.add(inspectArr, 0, result);
        let localIndex = 0;
        while(inspectIndex < chunks.size()){
            if (inspectArr[localIndex] === delim[matchIndex]) {
                inspectIndex++;
                localIndex++;
                matchIndex++;
                if (matchIndex === delimLen) {
                    const matchEnd = inspectIndex - delimLen;
                    const readyBytes = chunks.slice(0, matchEnd);
                    yield readyBytes;
                    chunks.shift(inspectIndex);
                    inspectIndex = 0;
                    matchIndex = 0;
                }
            } else {
                if (matchIndex === 0) {
                    inspectIndex++;
                    localIndex++;
                } else {
                    matchIndex = delimLPS[matchIndex - 1];
                }
            }
        }
    }
}
async function* readStringDelim(reader, delim, decoderOpts) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder(decoderOpts?.encoding, decoderOpts);
    for await (const chunk of readDelim(reader, encoder.encode(delim))){
        yield decoder.decode(chunk);
    }
}
async function* readLines(reader, decoderOpts) {
    const bufReader = new BufReader(reader);
    let chunks = [];
    const decoder = new TextDecoder(decoderOpts?.encoding, decoderOpts);
    while(true){
        const res = await bufReader.readLine();
        if (!res) {
            if (chunks.length > 0) {
                yield decoder.decode(concat(...chunks));
            }
            break;
        }
        chunks.push(res.line);
        if (!res.more) {
            yield decoder.decode(concat(...chunks));
            chunks = [];
        }
    }
}
const DEFAULT_BUFFER_SIZE1 = 32 * 1024;
async function copyN(r, dest, size) {
    let bytesRead = 0;
    let buf = new Uint8Array(DEFAULT_BUFFER_SIZE1);
    while(bytesRead < size){
        if (size - bytesRead < DEFAULT_BUFFER_SIZE1) {
            buf = new Uint8Array(size - bytesRead);
        }
        const result = await r.read(buf);
        const nread = result ?? 0;
        bytesRead += nread;
        if (nread > 0) {
            let n = 0;
            while(n < nread){
                n += await dest.write(buf.slice(n, nread));
            }
            assert1(n === nread, "could not write");
        }
        if (result === null) {
            break;
        }
    }
    return bytesRead;
}
async function readShort(buf) {
    const high = await buf.readByte();
    if (high === null) return null;
    const low = await buf.readByte();
    if (low === null) throw new Deno.errors.UnexpectedEof();
    return high << 8 | low;
}
async function readInt(buf) {
    const high = await readShort(buf);
    if (high === null) return null;
    const low = await readShort(buf);
    if (low === null) throw new Deno.errors.UnexpectedEof();
    return high << 16 | low;
}
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
async function readLong(buf) {
    const high = await readInt(buf);
    if (high === null) return null;
    const low = await readInt(buf);
    if (low === null) throw new Deno.errors.UnexpectedEof();
    const big = BigInt(high) << 32n | BigInt(low);
    if (big > MAX_SAFE_INTEGER) {
        throw new RangeError("Long value too big to be represented as a JavaScript number.");
    }
    return Number(big);
}
function sliceLongToBytes(d, dest = new Array(8)) {
    let big = BigInt(d);
    for(let i = 0; i < 8; i++){
        dest[7 - i] = Number(big & 255n);
        big >>= 8n;
    }
    return dest;
}
class StringReader extends Buffer {
    constructor(s){
        super(new TextEncoder().encode(s).buffer);
    }
}
class MultiReader {
    readers;
    currentIndex = 0;
    constructor(...readers){
        this.readers = readers;
    }
    async read(p) {
        const r = this.readers[this.currentIndex];
        if (!r) return null;
        const result = await r.read(p);
        if (result === null) {
            this.currentIndex++;
            return 0;
        }
        return result;
    }
}
class LimitedReader {
    reader;
    limit;
    constructor(reader, limit){
        this.reader = reader;
        this.limit = limit;
    }
    async read(p) {
        if (this.limit <= 0) {
            return null;
        }
        if (p.length > this.limit) {
            p = p.subarray(0, this.limit);
        }
        const n = await this.reader.read(p);
        if (n == null) {
            return null;
        }
        this.limit -= n;
        return n;
    }
}
function isCloser(value) {
    return typeof value === "object" && value != null && "close" in value && typeof value["close"] === "function";
}
function readerFromIterable(iterable) {
    const iterator = iterable[Symbol.asyncIterator]?.() ?? iterable[Symbol.iterator]?.();
    const buffer = new Buffer();
    return {
        async read (p) {
            if (buffer.length == 0) {
                const result = await iterator.next();
                if (result.done) {
                    return null;
                } else {
                    if (result.value.byteLength <= p.byteLength) {
                        p.set(result.value);
                        return result.value.byteLength;
                    }
                    p.set(result.value.subarray(0, p.byteLength));
                    await writeAll(buffer, result.value.subarray(p.byteLength));
                    return p.byteLength;
                }
            } else {
                const n = await buffer.read(p);
                if (n == null) {
                    return this.read(p);
                }
                return n;
            }
        }
    };
}
function writerFromStreamWriter(streamWriter) {
    return {
        async write (p) {
            await streamWriter.ready;
            await streamWriter.write(p);
            return p.length;
        }
    };
}
function readerFromStreamReader(streamReader) {
    const buffer = new Buffer();
    return {
        async read (p) {
            if (buffer.empty()) {
                const res = await streamReader.read();
                if (res.done) {
                    return null;
                }
                await writeAll(buffer, res.value);
            }
            return buffer.read(p);
        }
    };
}
function writableStreamFromWriter(writer, options = {
}) {
    const { autoClose =true  } = options;
    return new WritableStream({
        async write (chunk, controller) {
            try {
                await writeAll(writer, chunk);
            } catch (e) {
                controller.error(e);
                if (isCloser(writer) && autoClose) {
                    writer.close();
                }
            }
        },
        close () {
            if (isCloser(writer) && autoClose) {
                writer.close();
            }
        },
        abort () {
            if (isCloser(writer) && autoClose) {
                writer.close();
            }
        }
    });
}
function readableStreamFromIterable(iterable) {
    const iterator = iterable[Symbol.asyncIterator]?.() ?? iterable[Symbol.iterator]?.();
    return new ReadableStream({
        async pull (controller) {
            const { value , done  } = await iterator.next();
            if (done) {
                controller.close();
            } else {
                controller.enqueue(value);
            }
        },
        async cancel (reason) {
            if (typeof iterator.throw == "function") {
                try {
                    await iterator.throw(reason);
                } catch  {
                }
            }
        }
    });
}
function readableStreamFromReader(reader, options = {
}) {
    const { autoClose =true , chunkSize =16640 , strategy ,  } = options;
    return new ReadableStream({
        async pull (controller) {
            const chunk = new Uint8Array(chunkSize);
            try {
                const read = await reader.read(chunk);
                if (read === null) {
                    if (isCloser(reader) && autoClose) {
                        reader.close();
                    }
                    controller.close();
                    return;
                }
                controller.enqueue(chunk.subarray(0, read));
            } catch (e) {
                controller.error(e);
                if (isCloser(reader)) {
                    reader.close();
                }
            }
        },
        cancel () {
            if (isCloser(reader) && autoClose) {
                reader.close();
            }
        }
    }, strategy);
}
const decoder2 = new TextDecoder();
class StringWriter {
    base;
    chunks = [];
    byteLength = 0;
    cache;
    constructor(base = ""){
        this.base = base;
        const c = new TextEncoder().encode(base);
        this.chunks.push(c);
        this.byteLength += c.byteLength;
    }
    write(p) {
        return Promise.resolve(this.writeSync(p));
    }
    writeSync(p) {
        this.chunks.push(p);
        this.byteLength += p.byteLength;
        this.cache = undefined;
        return p.byteLength;
    }
    toString() {
        if (this.cache) {
            return this.cache;
        }
        const buf = new Uint8Array(this.byteLength);
        let offs = 0;
        for (const chunk of this.chunks){
            buf.set(chunk, offs);
            offs += chunk.byteLength;
        }
        this.cache = decoder2.decode(buf);
        return this.cache;
    }
}
const mod3 = {
    Buffer,
    BufferFullError,
    PartialReadError,
    BufReader,
    BufWriter,
    BufWriterSync,
    readDelim,
    readStringDelim,
    readLines,
    readAll,
    readAllSync,
    readRange,
    readRangeSync,
    writeAll,
    writeAllSync,
    iter,
    iterSync,
    copy: copy1,
    copyN,
    readShort,
    readInt,
    readLong,
    sliceLongToBytes,
    StringReader,
    MultiReader,
    LimitedReader,
    readerFromIterable,
    writerFromStreamWriter,
    readerFromStreamReader,
    writableStreamFromWriter,
    readableStreamFromIterable,
    readableStreamFromReader,
    StringWriter
};
function isRequestMessage(data) {
    return Array.isArray(data) && data.length === 4 && data[0] === 0 && typeof data[1] === "number" && typeof data[2] === "string" && Array.isArray(data[3]);
}
function isResponseMessage(data) {
    return Array.isArray(data) && data.length === 4 && data[0] === 1 && typeof data[1] === "number" && typeof data[2] !== "undefined" && typeof data[3] !== "undefined";
}
function isNotificationMessage(data) {
    return Array.isArray(data) && data.length === 3 && data[0] === 2 && typeof data[1] === "string" && Array.isArray(data[2]);
}
class Indexer {
    #max;
    #val;
    constructor(max){
        if (max != null && max < 2) {
            throw new Error(`The attribute 'max' must be greater than 1 but ${max} has specified`);
        }
        this.#max = max ?? Number.MAX_SAFE_INTEGER;
        this.#val = -1;
    }
    next() {
        if (this.#val >= this.#max) {
            this.#val = -1;
        }
        this.#val += 1;
        return this.#val;
    }
}
class TimeoutError extends Error {
    constructor(){
        super("the process didn't complete in time");
        this.name = "TimeoutError";
    }
}
class ResponseWaiter {
    #waiters;
    #timeout;
    constructor(timeout = 10000){
        this.#waiters = new Map();
        this.#timeout = timeout;
    }
    get waiterCount() {
        return this.#waiters.size;
    }
    wait(msgid, timeout) {
        let response = this.#waiters.get(msgid)?.response;
        if (!response) {
            response = deferred2();
            const timer = setTimeout(()=>{
                const response = this.#waiters.get(msgid)?.response;
                if (!response) {
                    return;
                }
                response.reject(new TimeoutError());
                this.#waiters.delete(msgid);
            }, timeout ?? this.#timeout);
            this.#waiters.set(msgid, {
                timer,
                response
            });
        }
        return response;
    }
    provide(message) {
        const [_type, msgid, _error, _result] = message;
        const waiter = this.#waiters.get(msgid);
        if (!waiter) {
            return false;
        }
        this.#waiters.delete(msgid);
        const { timer , response  } = waiter;
        clearTimeout(timer);
        response.resolve(message);
        return true;
    }
}
const MSGID_THRESHOLD = 2 ** 32;
class Session {
    #indexer;
    #waiter;
    #reader;
    #writer;
    #listener;
    #closed;
    #closedSignal;
    dispatcher;
    constructor(reader, writer, dispatcher = {
    }, options = {
    }){
        this.dispatcher = dispatcher;
        this.#indexer = new Indexer(MSGID_THRESHOLD);
        this.#waiter = new ResponseWaiter(options.responseTimeout);
        this.#reader = reader;
        this.#writer = writer;
        this.#closed = false;
        this.#closedSignal = deferred2();
        this.#listener = this.listen().catch((e)=>{
            if (options.errorCallback) {
                options.errorCallback(e);
            } else {
                console.error(`Unexpected error occured in session: ${e}`);
            }
        });
    }
    async send(data) {
        await mod3.writeAll(this.#writer, data);
    }
    async dispatch(method, ...params) {
        if (!Object.prototype.hasOwnProperty.call(this.dispatcher, method)) {
            const propertyNames = Object.getOwnPropertyNames(this.dispatcher);
            throw new Error(`No method '${method}' exists in ${JSON.stringify(propertyNames)}`);
        }
        return await this.dispatcher[method].apply(this, params);
    }
    async handleRequest(request) {
        const [_, msgid, method, params] = request;
        const [result, error] = await (async ()=>{
            let result = null;
            let error = null;
            try {
                result = await this.dispatch(method, ...params);
            } catch (e) {
                error = e.stack ?? e.toString();
            }
            return [
                result,
                error
            ];
        })();
        const response = [
            1,
            msgid,
            error,
            result
        ];
        await this.send(encode1(response));
    }
    handleResponse(response) {
        if (!this.#waiter.provide(response)) {
            console.warn("Unexpected response message received", response);
        }
    }
    async handleNotification(notification) {
        const [_, method, params] = notification;
        try {
            await this.dispatch(method, ...params);
        } catch (e) {
            console.error(e);
        }
    }
    async listen() {
        const iter = decodeStream(mod3.iter(this.#reader));
        try {
            while(!this.#closed){
                const { done , value  } = await Promise.race([
                    this.#closedSignal,
                    iter.next(), 
                ]);
                if (done) {
                    return;
                }
                if (isRequestMessage(value)) {
                    this.handleRequest(value);
                } else if (isResponseMessage(value)) {
                    this.handleResponse(value);
                } else if (isNotificationMessage(value)) {
                    this.handleNotification(value);
                } else {
                    console.warn(`Unexpected data received: ${value}`);
                    continue;
                }
            }
        } catch (e) {
            if (e instanceof SessionClosedError) {
                return;
            }
            if (e instanceof Deno.errors.BadResource) {
                return;
            }
            throw e;
        }
    }
    dispose() {
        this.close();
    }
    close() {
        this.#closed = true;
        this.#closedSignal.reject(new SessionClosedError());
    }
    waitClosed() {
        return this.#listener;
    }
    async call(method, ...params) {
        if (this.#closed) {
            throw new SessionClosedError();
        }
        const msgid = this.#indexer.next();
        const data = [
            0,
            msgid,
            method,
            params
        ];
        const [_, response] = await Promise.race([
            this.#closedSignal,
            Promise.all([
                this.send(encode1(data)),
                this.#waiter.wait(msgid)
            ]), 
        ]);
        const [err, result] = response.slice(2);
        if (err) {
            const paramsStr = JSON.stringify(params);
            const errStr = typeof err === "string" ? err : JSON.stringify(err);
            throw new Error(`Failed to call '${method}' with ${paramsStr}: ${errStr}`);
        }
        return result;
    }
    async notify(method, ...params) {
        if (this.#closed) {
            throw new SessionClosedError();
        }
        const data = [
            2,
            method,
            params
        ];
        await Promise.race([
            this.#closedSignal,
            this.send(encode1(data))
        ]);
    }
    clearDispatcher() {
        this.dispatcher = {
        };
    }
    extendDispatcher(dispatcher) {
        this.dispatcher = {
            ...this.dispatcher,
            ...dispatcher
        };
    }
}
class SessionClosedError extends Error {
    constructor(){
        super("The session is closed");
        this.name = "SessionClosedError";
    }
}
class DenoStdInternalError2 extends Error {
    constructor(message){
        super(message);
        this.name = "DenoStdInternalError";
    }
}
function assert3(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError2(msg);
    }
}
function concat1(...buf) {
    let length = 0;
    for (const b of buf){
        length += b.length;
    }
    const output = new Uint8Array(length);
    let index = 0;
    for (const b1 of buf){
        output.set(b1, index);
        index += b1.length;
    }
    return output;
}
function copy2(src, dst, off = 0) {
    off = Math.max(0, Math.min(off, dst.byteLength));
    const dstBytesAvailable = dst.byteLength - off;
    if (src.byteLength > dstBytesAvailable) {
        src = src.subarray(0, dstBytesAvailable);
    }
    dst.set(src, off);
    return src.byteLength;
}
const MIN_READ1 = 32 * 1024;
const MAX_SIZE1 = 2 ** 32 - 2;
class Buffer1 {
    #buf;
    #off = 0;
    constructor(ab){
        this.#buf = ab === undefined ? new Uint8Array(0) : new Uint8Array(ab);
    }
    bytes(options = {
        copy: true
    }) {
        if (options.copy === false) return this.#buf.subarray(this.#off);
        return this.#buf.slice(this.#off);
    }
    empty() {
        return this.#buf.byteLength <= this.#off;
    }
    get length() {
        return this.#buf.byteLength - this.#off;
    }
    get capacity() {
        return this.#buf.buffer.byteLength;
    }
    truncate(n) {
        if (n === 0) {
            this.reset();
            return;
        }
        if (n < 0 || n > this.length) {
            throw Error("bytes.Buffer: truncation out of range");
        }
        this.#reslice(this.#off + n);
    }
    reset() {
        this.#reslice(0);
        this.#off = 0;
    }
     #tryGrowByReslice(n) {
        const l = this.#buf.byteLength;
        if (n <= this.capacity - l) {
            this.#reslice(l + n);
            return l;
        }
        return -1;
    }
     #reslice(len) {
        assert3(len <= this.#buf.buffer.byteLength);
        this.#buf = new Uint8Array(this.#buf.buffer, 0, len);
    }
    readSync(p) {
        if (this.empty()) {
            this.reset();
            if (p.byteLength === 0) {
                return 0;
            }
            return null;
        }
        const nread = copy2(this.#buf.subarray(this.#off), p);
        this.#off += nread;
        return nread;
    }
    read(p) {
        const rr = this.readSync(p);
        return Promise.resolve(rr);
    }
    writeSync(p) {
        const m = this.#grow(p.byteLength);
        return copy2(p, this.#buf, m);
    }
    write(p) {
        const n = this.writeSync(p);
        return Promise.resolve(n);
    }
     #grow(n) {
        const m = this.length;
        if (m === 0 && this.#off !== 0) {
            this.reset();
        }
        const i = this.#tryGrowByReslice(n);
        if (i >= 0) {
            return i;
        }
        const c = this.capacity;
        if (n <= Math.floor(c / 2) - m) {
            copy2(this.#buf.subarray(this.#off), this.#buf);
        } else if (c + n > MAX_SIZE1) {
            throw new Error("The buffer cannot be grown beyond the maximum size.");
        } else {
            const buf = new Uint8Array(Math.min(2 * c + n, MAX_SIZE1));
            copy2(this.#buf.subarray(this.#off), buf);
            this.#buf = buf;
        }
        this.#off = 0;
        this.#reslice(Math.min(m + n, MAX_SIZE1));
        return m;
    }
    grow(n) {
        if (n < 0) {
            throw Error("Buffer.grow: negative count");
        }
        const m = this.#grow(n);
        this.#reslice(m);
    }
    async readFrom(r) {
        let n = 0;
        const tmp = new Uint8Array(MIN_READ1);
        while(true){
            const shouldGrow = this.capacity - this.length < MIN_READ1;
            const buf = shouldGrow ? tmp : new Uint8Array(this.#buf.buffer, this.length);
            const nread = await r.read(buf);
            if (nread === null) {
                return n;
            }
            if (shouldGrow) this.writeSync(buf.subarray(0, nread));
            else this.#reslice(this.length + nread);
            n += nread;
        }
    }
    readFromSync(r) {
        let n = 0;
        const tmp = new Uint8Array(MIN_READ1);
        while(true){
            const shouldGrow = this.capacity - this.length < MIN_READ1;
            const buf = shouldGrow ? tmp : new Uint8Array(this.#buf.buffer, this.length);
            const nread = r.readSync(buf);
            if (nread === null) {
                return n;
            }
            if (shouldGrow) this.writeSync(buf.subarray(0, nread));
            else this.#reslice(this.length + nread);
            n += nread;
        }
    }
}
class BytesList1 {
    len = 0;
    chunks = [];
    constructor(){
    }
    size() {
        return this.len;
    }
    add(value, start = 0, end = value.byteLength) {
        if (value.byteLength === 0 || end - start === 0) {
            return;
        }
        checkRange1(start, end, value.byteLength);
        this.chunks.push({
            value,
            end,
            start,
            offset: this.len
        });
        this.len += end - start;
    }
    shift(n) {
        if (n === 0) {
            return;
        }
        if (this.len <= n) {
            this.chunks = [];
            this.len = 0;
            return;
        }
        const idx = this.getChunkIndex(n);
        this.chunks.splice(0, idx);
        const [chunk] = this.chunks;
        if (chunk) {
            const diff = n - chunk.offset;
            chunk.start += diff;
        }
        let offset = 0;
        for (const chunk1 of this.chunks){
            chunk1.offset = offset;
            offset += chunk1.end - chunk1.start;
        }
        this.len = offset;
    }
    getChunkIndex(pos) {
        let max = this.chunks.length;
        let min = 0;
        while(true){
            const i = min + Math.floor((max - min) / 2);
            if (i < 0 || this.chunks.length <= i) {
                return -1;
            }
            const { offset , start , end  } = this.chunks[i];
            const len = end - start;
            if (offset <= pos && pos < offset + len) {
                return i;
            } else if (offset + len <= pos) {
                min = i + 1;
            } else {
                max = i - 1;
            }
        }
    }
    get(i) {
        if (i < 0 || this.len <= i) {
            throw new Error("out of range");
        }
        const idx = this.getChunkIndex(i);
        const { value , offset , start  } = this.chunks[idx];
        return value[start + i - offset];
    }
    *iterator(start = 0) {
        const startIdx = this.getChunkIndex(start);
        if (startIdx < 0) return;
        const first = this.chunks[startIdx];
        let firstOffset = start - first.offset;
        for(let i = startIdx; i < this.chunks.length; i++){
            const chunk = this.chunks[i];
            for(let j = chunk.start + firstOffset; j < chunk.end; j++){
                yield chunk.value[j];
            }
            firstOffset = 0;
        }
    }
    slice(start, end = this.len) {
        if (end === start) {
            return new Uint8Array();
        }
        checkRange1(start, end, this.len);
        const result = new Uint8Array(end - start);
        const startIdx = this.getChunkIndex(start);
        const endIdx = this.getChunkIndex(end - 1);
        let written = 0;
        for(let i = startIdx; i < endIdx; i++){
            const chunk = this.chunks[i];
            const len = chunk.end - chunk.start;
            result.set(chunk.value.subarray(chunk.start, chunk.end), written);
            written += len;
        }
        const last = this.chunks[endIdx];
        const rest = end - start - written;
        result.set(last.value.subarray(last.start, last.start + rest), written);
        return result;
    }
    concat() {
        const result = new Uint8Array(this.len);
        let sum = 0;
        for (const { value , start , end  } of this.chunks){
            result.set(value.subarray(start, end), sum);
            sum += end - start;
        }
        return result;
    }
}
function checkRange1(start, end, len) {
    if (start < 0 || len < start || end < 0 || len < end || end < start) {
        throw new Error("invalid range");
    }
}
const { Deno: Deno2  } = globalThis;
typeof Deno2?.noColor === "boolean" ? Deno2.noColor : true;
new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))", 
].join("|"), "g");
var DiffType1;
(function(DiffType) {
    DiffType["removed"] = "removed";
    DiffType["common"] = "common";
    DiffType["added"] = "added";
})(DiffType1 || (DiffType1 = {
}));
class AssertionError1 extends Error {
    constructor(message){
        super(message);
        this.name = "AssertionError";
    }
}
function assert4(expr, msg = "") {
    if (!expr) {
        throw new AssertionError1(msg);
    }
}
const DEFAULT_BUFFER_SIZE2 = 32 * 1024;
async function readAll1(r) {
    const buf = new Buffer1();
    await buf.readFrom(r);
    return buf.bytes();
}
function readAllSync1(r) {
    const buf = new Buffer1();
    buf.readFromSync(r);
    return buf.bytes();
}
async function readRange1(r, range) {
    let length = range.end - range.start + 1;
    assert4(length > 0, "Invalid byte range was passed.");
    await r.seek(range.start, Deno.SeekMode.Start);
    const result = new Uint8Array(length);
    let off = 0;
    while(length){
        const p = new Uint8Array(Math.min(length, DEFAULT_BUFFER_SIZE2));
        const nread = await r.read(p);
        assert4(nread !== null, "Unexpected EOF reach while reading a range.");
        assert4(nread > 0, "Unexpected read of 0 bytes while reading a range.");
        copy2(p, result, off);
        off += nread;
        length -= nread;
        assert4(length >= 0, "Unexpected length remaining after reading range.");
    }
    return result;
}
function readRangeSync1(r, range) {
    let length = range.end - range.start + 1;
    assert4(length > 0, "Invalid byte range was passed.");
    r.seekSync(range.start, Deno.SeekMode.Start);
    const result = new Uint8Array(length);
    let off = 0;
    while(length){
        const p = new Uint8Array(Math.min(length, DEFAULT_BUFFER_SIZE2));
        const nread = r.readSync(p);
        assert4(nread !== null, "Unexpected EOF reach while reading a range.");
        assert4(nread > 0, "Unexpected read of 0 bytes while reading a range.");
        copy2(p, result, off);
        off += nread;
        length -= nread;
        assert4(length >= 0, "Unexpected length remaining after reading range.");
    }
    return result;
}
async function writeAll1(w, arr) {
    let nwritten = 0;
    while(nwritten < arr.length){
        nwritten += await w.write(arr.subarray(nwritten));
    }
}
function writeAllSync1(w, arr) {
    let nwritten = 0;
    while(nwritten < arr.length){
        nwritten += w.writeSync(arr.subarray(nwritten));
    }
}
async function* iter1(r, options) {
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE2;
    const b = new Uint8Array(bufSize);
    while(true){
        const result = await r.read(b);
        if (result === null) {
            break;
        }
        yield b.subarray(0, result);
    }
}
function* iterSync1(r, options) {
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE2;
    const b = new Uint8Array(bufSize);
    while(true){
        const result = r.readSync(b);
        if (result === null) {
            break;
        }
        yield b.subarray(0, result);
    }
}
async function copy3(src, dst, options) {
    let n = 0;
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE2;
    const b = new Uint8Array(bufSize);
    let gotEOF = false;
    while(gotEOF === false){
        const result = await src.read(b);
        if (result === null) {
            gotEOF = true;
        } else {
            let nwritten = 0;
            while(nwritten < result){
                nwritten += await dst.write(b.subarray(nwritten, result));
            }
            n += nwritten;
        }
    }
    return n;
}
const DEFAULT_BUF_SIZE1 = 4096;
const MIN_BUF_SIZE1 = 16;
const CR1 = "\r".charCodeAt(0);
const LF1 = "\n".charCodeAt(0);
class BufferFullError1 extends Error {
    partial;
    name = "BufferFullError";
    constructor(partial){
        super("Buffer full");
        this.partial = partial;
    }
}
class PartialReadError1 extends Error {
    name = "PartialReadError";
    partial;
    constructor(){
        super("Encountered UnexpectedEof, data only partially read");
    }
}
class BufReader1 {
    buf;
    rd;
    r = 0;
    w = 0;
    eof = false;
    static create(r, size = 4096) {
        return r instanceof BufReader1 ? r : new BufReader1(r, size);
    }
    constructor(rd, size = 4096){
        if (size < 16) {
            size = MIN_BUF_SIZE1;
        }
        this._reset(new Uint8Array(size), rd);
    }
    size() {
        return this.buf.byteLength;
    }
    buffered() {
        return this.w - this.r;
    }
    async _fill() {
        if (this.r > 0) {
            this.buf.copyWithin(0, this.r, this.w);
            this.w -= this.r;
            this.r = 0;
        }
        if (this.w >= this.buf.byteLength) {
            throw Error("bufio: tried to fill full buffer");
        }
        for(let i = 100; i > 0; i--){
            const rr = await this.rd.read(this.buf.subarray(this.w));
            if (rr === null) {
                this.eof = true;
                return;
            }
            assert3(rr >= 0, "negative read");
            this.w += rr;
            if (rr > 0) {
                return;
            }
        }
        throw new Error(`No progress after ${100} read() calls`);
    }
    reset(r) {
        this._reset(this.buf, r);
    }
    _reset(buf, rd) {
        this.buf = buf;
        this.rd = rd;
        this.eof = false;
    }
    async read(p) {
        let rr = p.byteLength;
        if (p.byteLength === 0) return rr;
        if (this.r === this.w) {
            if (p.byteLength >= this.buf.byteLength) {
                const rr = await this.rd.read(p);
                const nread = rr ?? 0;
                assert3(nread >= 0, "negative read");
                return rr;
            }
            this.r = 0;
            this.w = 0;
            rr = await this.rd.read(this.buf);
            if (rr === 0 || rr === null) return rr;
            assert3(rr >= 0, "negative read");
            this.w += rr;
        }
        const copied = copy2(this.buf.subarray(this.r, this.w), p, 0);
        this.r += copied;
        return copied;
    }
    async readFull(p) {
        let bytesRead = 0;
        while(bytesRead < p.length){
            try {
                const rr = await this.read(p.subarray(bytesRead));
                if (rr === null) {
                    if (bytesRead === 0) {
                        return null;
                    } else {
                        throw new PartialReadError1();
                    }
                }
                bytesRead += rr;
            } catch (err) {
                err.partial = p.subarray(0, bytesRead);
                throw err;
            }
        }
        return p;
    }
    async readByte() {
        while(this.r === this.w){
            if (this.eof) return null;
            await this._fill();
        }
        const c = this.buf[this.r];
        this.r++;
        return c;
    }
    async readString(delim) {
        if (delim.length !== 1) {
            throw new Error("Delimiter should be a single character");
        }
        const buffer = await this.readSlice(delim.charCodeAt(0));
        if (buffer === null) return null;
        return new TextDecoder().decode(buffer);
    }
    async readLine() {
        let line;
        try {
            line = await this.readSlice(LF1);
        } catch (err) {
            if (err instanceof Deno.errors.BadResource) {
                throw err;
            }
            let { partial  } = err;
            assert3(partial instanceof Uint8Array, "bufio: caught error from `readSlice()` without `partial` property");
            if (!(err instanceof BufferFullError1)) {
                throw err;
            }
            if (!this.eof && partial.byteLength > 0 && partial[partial.byteLength - 1] === CR1) {
                assert3(this.r > 0, "bufio: tried to rewind past start of buffer");
                this.r--;
                partial = partial.subarray(0, partial.byteLength - 1);
            }
            return {
                line: partial,
                more: !this.eof
            };
        }
        if (line === null) {
            return null;
        }
        if (line.byteLength === 0) {
            return {
                line,
                more: false
            };
        }
        if (line[line.byteLength - 1] == LF1) {
            let drop = 1;
            if (line.byteLength > 1 && line[line.byteLength - 2] === CR1) {
                drop = 2;
            }
            line = line.subarray(0, line.byteLength - drop);
        }
        return {
            line,
            more: false
        };
    }
    async readSlice(delim) {
        let s = 0;
        let slice;
        while(true){
            let i = this.buf.subarray(this.r + s, this.w).indexOf(delim);
            if (i >= 0) {
                i += s;
                slice = this.buf.subarray(this.r, this.r + i + 1);
                this.r += i + 1;
                break;
            }
            if (this.eof) {
                if (this.r === this.w) {
                    return null;
                }
                slice = this.buf.subarray(this.r, this.w);
                this.r = this.w;
                break;
            }
            if (this.buffered() >= this.buf.byteLength) {
                this.r = this.w;
                const oldbuf = this.buf;
                const newbuf = this.buf.slice(0);
                this.buf = newbuf;
                throw new BufferFullError1(oldbuf);
            }
            s = this.w - this.r;
            try {
                await this._fill();
            } catch (err) {
                err.partial = slice;
                throw err;
            }
        }
        return slice;
    }
    async peek(n) {
        if (n < 0) {
            throw Error("negative count");
        }
        let avail = this.w - this.r;
        while(avail < n && avail < this.buf.byteLength && !this.eof){
            try {
                await this._fill();
            } catch (err) {
                err.partial = this.buf.subarray(this.r, this.w);
                throw err;
            }
            avail = this.w - this.r;
        }
        if (avail === 0 && this.eof) {
            return null;
        } else if (avail < n && this.eof) {
            return this.buf.subarray(this.r, this.r + avail);
        } else if (avail < n) {
            throw new BufferFullError1(this.buf.subarray(this.r, this.w));
        }
        return this.buf.subarray(this.r, this.r + n);
    }
}
class AbstractBufBase1 {
    buf;
    usedBufferBytes = 0;
    err = null;
    size() {
        return this.buf.byteLength;
    }
    available() {
        return this.buf.byteLength - this.usedBufferBytes;
    }
    buffered() {
        return this.usedBufferBytes;
    }
}
class BufWriter1 extends AbstractBufBase1 {
    writer;
    static create(writer, size = 4096) {
        return writer instanceof BufWriter1 ? writer : new BufWriter1(writer, size);
    }
    constructor(writer, size = 4096){
        super();
        this.writer = writer;
        if (size <= 0) {
            size = DEFAULT_BUF_SIZE1;
        }
        this.buf = new Uint8Array(size);
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.writer = w;
    }
    async flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            await writeAll1(this.writer, this.buf.subarray(0, this.usedBufferBytes));
        } catch (e) {
            this.err = e;
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    async write(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = await this.writer.write(data);
                } catch (e) {
                    this.err = e;
                    throw e;
                }
            } else {
                numBytesWritten = copy2(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                await this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy2(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
class BufWriterSync1 extends AbstractBufBase1 {
    writer;
    static create(writer, size = 4096) {
        return writer instanceof BufWriterSync1 ? writer : new BufWriterSync1(writer, size);
    }
    constructor(writer, size = 4096){
        super();
        this.writer = writer;
        if (size <= 0) {
            size = DEFAULT_BUF_SIZE1;
        }
        this.buf = new Uint8Array(size);
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.writer = w;
    }
    flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            writeAllSync1(this.writer, this.buf.subarray(0, this.usedBufferBytes));
        } catch (e) {
            this.err = e;
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    writeSync(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = this.writer.writeSync(data);
                } catch (e) {
                    this.err = e;
                    throw e;
                }
            } else {
                numBytesWritten = copy2(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy2(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
function createLPS1(pat) {
    const lps = new Uint8Array(pat.length);
    lps[0] = 0;
    let prefixEnd = 0;
    let i = 1;
    while(i < lps.length){
        if (pat[i] == pat[prefixEnd]) {
            prefixEnd++;
            lps[i] = prefixEnd;
            i++;
        } else if (prefixEnd === 0) {
            lps[i] = 0;
            i++;
        } else {
            prefixEnd = lps[prefixEnd - 1];
        }
    }
    return lps;
}
async function* readDelim1(reader, delim) {
    const delimLen = delim.length;
    const delimLPS = createLPS1(delim);
    const chunks = new BytesList1();
    const bufSize = Math.max(1024, delimLen + 1);
    let inspectIndex = 0;
    let matchIndex = 0;
    while(true){
        const inspectArr = new Uint8Array(bufSize);
        const result = await reader.read(inspectArr);
        if (result === null) {
            yield chunks.concat();
            return;
        } else if (result < 0) {
            return;
        }
        chunks.add(inspectArr, 0, result);
        let localIndex = 0;
        while(inspectIndex < chunks.size()){
            if (inspectArr[localIndex] === delim[matchIndex]) {
                inspectIndex++;
                localIndex++;
                matchIndex++;
                if (matchIndex === delimLen) {
                    const matchEnd = inspectIndex - delimLen;
                    const readyBytes = chunks.slice(0, matchEnd);
                    yield readyBytes;
                    chunks.shift(inspectIndex);
                    inspectIndex = 0;
                    matchIndex = 0;
                }
            } else {
                if (matchIndex === 0) {
                    inspectIndex++;
                    localIndex++;
                } else {
                    matchIndex = delimLPS[matchIndex - 1];
                }
            }
        }
    }
}
async function* readStringDelim1(reader, delim, decoderOpts) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder(decoderOpts?.encoding, decoderOpts);
    for await (const chunk of readDelim1(reader, encoder.encode(delim))){
        yield decoder.decode(chunk);
    }
}
async function* readLines1(reader, decoderOpts) {
    const bufReader = new BufReader1(reader);
    let chunks = [];
    const decoder = new TextDecoder(decoderOpts?.encoding, decoderOpts);
    while(true){
        const res = await bufReader.readLine();
        if (!res) {
            if (chunks.length > 0) {
                yield decoder.decode(concat1(...chunks));
            }
            break;
        }
        chunks.push(res.line);
        if (!res.more) {
            yield decoder.decode(concat1(...chunks));
            chunks = [];
        }
    }
}
const DEFAULT_BUFFER_SIZE3 = 32 * 1024;
async function copyN1(r, dest, size) {
    let bytesRead = 0;
    let buf = new Uint8Array(DEFAULT_BUFFER_SIZE3);
    while(bytesRead < size){
        if (size - bytesRead < DEFAULT_BUFFER_SIZE3) {
            buf = new Uint8Array(size - bytesRead);
        }
        const result = await r.read(buf);
        const nread = result ?? 0;
        bytesRead += nread;
        if (nread > 0) {
            let n = 0;
            while(n < nread){
                n += await dest.write(buf.slice(n, nread));
            }
            assert3(n === nread, "could not write");
        }
        if (result === null) {
            break;
        }
    }
    return bytesRead;
}
async function readShort1(buf) {
    const high = await buf.readByte();
    if (high === null) return null;
    const low = await buf.readByte();
    if (low === null) throw new Deno.errors.UnexpectedEof();
    return high << 8 | low;
}
async function readInt1(buf) {
    const high = await readShort1(buf);
    if (high === null) return null;
    const low = await readShort1(buf);
    if (low === null) throw new Deno.errors.UnexpectedEof();
    return high << 16 | low;
}
const MAX_SAFE_INTEGER1 = BigInt(Number.MAX_SAFE_INTEGER);
async function readLong1(buf) {
    const high = await readInt1(buf);
    if (high === null) return null;
    const low = await readInt1(buf);
    if (low === null) throw new Deno.errors.UnexpectedEof();
    const big = BigInt(high) << 32n | BigInt(low);
    if (big > MAX_SAFE_INTEGER1) {
        throw new RangeError("Long value too big to be represented as a JavaScript number.");
    }
    return Number(big);
}
function sliceLongToBytes1(d, dest = new Array(8)) {
    let big = BigInt(d);
    for(let i = 0; i < 8; i++){
        dest[7 - i] = Number(big & 255n);
        big >>= 8n;
    }
    return dest;
}
class StringReader1 extends Buffer1 {
    constructor(s){
        super(new TextEncoder().encode(s).buffer);
    }
}
class MultiReader1 {
    readers;
    currentIndex = 0;
    constructor(...readers){
        this.readers = readers;
    }
    async read(p) {
        const r = this.readers[this.currentIndex];
        if (!r) return null;
        const result = await r.read(p);
        if (result === null) {
            this.currentIndex++;
            return 0;
        }
        return result;
    }
}
class LimitedReader1 {
    reader;
    limit;
    constructor(reader, limit){
        this.reader = reader;
        this.limit = limit;
    }
    async read(p) {
        if (this.limit <= 0) {
            return null;
        }
        if (p.length > this.limit) {
            p = p.subarray(0, this.limit);
        }
        const n = await this.reader.read(p);
        if (n == null) {
            return null;
        }
        this.limit -= n;
        return n;
    }
}
function isCloser1(value) {
    return typeof value === "object" && value != null && "close" in value && typeof value["close"] === "function";
}
function readerFromIterable1(iterable) {
    const iterator = iterable[Symbol.asyncIterator]?.() ?? iterable[Symbol.iterator]?.();
    const buffer = new Buffer1();
    return {
        async read (p) {
            if (buffer.length == 0) {
                const result = await iterator.next();
                if (result.done) {
                    return null;
                } else {
                    if (result.value.byteLength <= p.byteLength) {
                        p.set(result.value);
                        return result.value.byteLength;
                    }
                    p.set(result.value.subarray(0, p.byteLength));
                    await writeAll1(buffer, result.value.subarray(p.byteLength));
                    return p.byteLength;
                }
            } else {
                const n = await buffer.read(p);
                if (n == null) {
                    return this.read(p);
                }
                return n;
            }
        }
    };
}
function writerFromStreamWriter1(streamWriter) {
    return {
        async write (p) {
            await streamWriter.ready;
            await streamWriter.write(p);
            return p.length;
        }
    };
}
function readerFromStreamReader1(streamReader) {
    const buffer = new Buffer1();
    return {
        async read (p) {
            if (buffer.empty()) {
                const res = await streamReader.read();
                if (res.done) {
                    return null;
                }
                await writeAll1(buffer, res.value);
            }
            return buffer.read(p);
        }
    };
}
function writableStreamFromWriter1(writer, options = {
}) {
    const { autoClose =true  } = options;
    return new WritableStream({
        async write (chunk, controller) {
            try {
                await writeAll1(writer, chunk);
            } catch (e) {
                controller.error(e);
                if (isCloser1(writer) && autoClose) {
                    writer.close();
                }
            }
        },
        close () {
            if (isCloser1(writer) && autoClose) {
                writer.close();
            }
        },
        abort () {
            if (isCloser1(writer) && autoClose) {
                writer.close();
            }
        }
    });
}
function readableStreamFromIterable1(iterable) {
    const iterator = iterable[Symbol.asyncIterator]?.() ?? iterable[Symbol.iterator]?.();
    return new ReadableStream({
        async pull (controller) {
            const { value , done  } = await iterator.next();
            if (done) {
                controller.close();
            } else {
                controller.enqueue(value);
            }
        }
    });
}
function readableStreamFromReader1(reader, options = {
}) {
    const { autoClose =true , chunkSize =16640 , strategy ,  } = options;
    return new ReadableStream({
        async pull (controller) {
            const chunk = new Uint8Array(chunkSize);
            try {
                const read = await reader.read(chunk);
                if (read === null) {
                    if (isCloser1(reader) && autoClose) {
                        reader.close();
                    }
                    controller.close();
                    return;
                }
                controller.enqueue(chunk.subarray(0, read));
            } catch (e) {
                controller.error(e);
                if (isCloser1(reader)) {
                    reader.close();
                }
            }
        },
        cancel () {
            if (isCloser1(reader) && autoClose) {
                reader.close();
            }
        }
    }, strategy);
}
const decoder1 = new TextDecoder();
class StringWriter1 {
    base;
    chunks = [];
    byteLength = 0;
    cache;
    constructor(base = ""){
        this.base = base;
        const c = new TextEncoder().encode(base);
        this.chunks.push(c);
        this.byteLength += c.byteLength;
    }
    write(p) {
        return Promise.resolve(this.writeSync(p));
    }
    writeSync(p) {
        this.chunks.push(p);
        this.byteLength += p.byteLength;
        this.cache = undefined;
        return p.byteLength;
    }
    toString() {
        if (this.cache) {
            return this.cache;
        }
        const buf = new Uint8Array(this.byteLength);
        let offs = 0;
        for (const chunk of this.chunks){
            buf.set(chunk, offs);
            offs += chunk.byteLength;
        }
        this.cache = decoder1.decode(buf);
        return this.cache;
    }
}
const mod4 = {
    Buffer: Buffer1,
    BufferFullError: BufferFullError1,
    PartialReadError: PartialReadError1,
    BufReader: BufReader1,
    BufWriter: BufWriter1,
    BufWriterSync: BufWriterSync1,
    readDelim: readDelim1,
    readStringDelim: readStringDelim1,
    readLines: readLines1,
    readAll: readAll1,
    readAllSync: readAllSync1,
    readRange: readRange1,
    readRangeSync: readRangeSync1,
    writeAll: writeAll1,
    writeAllSync: writeAllSync1,
    iter: iter1,
    iterSync: iterSync1,
    copy: copy3,
    copyN: copyN1,
    readShort: readShort1,
    readInt: readInt1,
    readLong: readLong1,
    sliceLongToBytes: sliceLongToBytes1,
    StringReader: StringReader1,
    MultiReader: MultiReader1,
    LimitedReader: LimitedReader1,
    readerFromIterable: readerFromIterable1,
    writerFromStreamWriter: writerFromStreamWriter1,
    readerFromStreamReader: readerFromStreamReader1,
    writableStreamFromWriter: writableStreamFromWriter1,
    readableStreamFromIterable: readableStreamFromIterable1,
    readableStreamFromReader: readableStreamFromReader1,
    StringWriter: StringWriter1
};
function deferred3() {
    let methods;
    let state = "pending";
    const promise = new Promise((resolve, reject)=>{
        methods = {
            async resolve (value) {
                await value;
                state = "fulfilled";
                resolve(value);
            },
            reject (reason) {
                state = "rejected";
                reject(reason);
            }
        };
    });
    Object.defineProperty(promise, "state", {
        get: ()=>state
    });
    return Object.assign(promise, methods);
}
var charset;
(function(charset) {
    charset[charset["BACKSPACE"] = 8] = "BACKSPACE";
    charset[charset["FORM_FEED"] = 12] = "FORM_FEED";
    charset[charset["NEWLINE"] = 10] = "NEWLINE";
    charset[charset["CARRIAGE_RETURN"] = 13] = "CARRIAGE_RETURN";
    charset[charset["TAB"] = 9] = "TAB";
    charset[charset["SPACE"] = 32] = "SPACE";
    charset[charset["EXCLAMATION_MARK"] = 33] = "EXCLAMATION_MARK";
    charset[charset["QUOTATION_MARK"] = 34] = "QUOTATION_MARK";
    charset[charset["NUMBER_SIGN"] = 35] = "NUMBER_SIGN";
    charset[charset["DOLLAR_SIGN"] = 36] = "DOLLAR_SIGN";
    charset[charset["PERCENT_SIGN"] = 37] = "PERCENT_SIGN";
    charset[charset["AMPERSAND"] = 38] = "AMPERSAND";
    charset[charset["APOSTROPHE"] = 39] = "APOSTROPHE";
    charset[charset["LEFT_PARENTHESIS"] = 40] = "LEFT_PARENTHESIS";
    charset[charset["RIGHT_PARENTHESIS"] = 41] = "RIGHT_PARENTHESIS";
    charset[charset["ASTERISK"] = 42] = "ASTERISK";
    charset[charset["PLUS_SIGN"] = 43] = "PLUS_SIGN";
    charset[charset["COMMA"] = 44] = "COMMA";
    charset[charset["HYPHEN_MINUS"] = 45] = "HYPHEN_MINUS";
    charset[charset["FULL_STOP"] = 46] = "FULL_STOP";
    charset[charset["SOLIDUS"] = 47] = "SOLIDUS";
    charset[charset["DIGIT_ZERO"] = 48] = "DIGIT_ZERO";
    charset[charset["DIGIT_ONE"] = 49] = "DIGIT_ONE";
    charset[charset["DIGIT_TWO"] = 50] = "DIGIT_TWO";
    charset[charset["DIGIT_THREE"] = 51] = "DIGIT_THREE";
    charset[charset["DIGIT_FOUR"] = 52] = "DIGIT_FOUR";
    charset[charset["DIGIT_FIVE"] = 53] = "DIGIT_FIVE";
    charset[charset["DIGIT_SIX"] = 54] = "DIGIT_SIX";
    charset[charset["DIGIT_SEVEN"] = 55] = "DIGIT_SEVEN";
    charset[charset["DIGIT_EIGHT"] = 56] = "DIGIT_EIGHT";
    charset[charset["DIGIT_NINE"] = 57] = "DIGIT_NINE";
    charset[charset["COLON"] = 58] = "COLON";
    charset[charset["SEMICOLON"] = 59] = "SEMICOLON";
    charset[charset["LESS_THAN_SIGN"] = 60] = "LESS_THAN_SIGN";
    charset[charset["EQUALS_SIGN"] = 61] = "EQUALS_SIGN";
    charset[charset["GREATER_THAN_SIGN"] = 62] = "GREATER_THAN_SIGN";
    charset[charset["QUESTION_MARK"] = 63] = "QUESTION_MARK";
    charset[charset["COMMERCIAL_AT"] = 64] = "COMMERCIAL_AT";
    charset[charset["LATIN_CAPITAL_LETTER_A"] = 65] = "LATIN_CAPITAL_LETTER_A";
    charset[charset["LATIN_CAPITAL_LETTER_B"] = 66] = "LATIN_CAPITAL_LETTER_B";
    charset[charset["LATIN_CAPITAL_LETTER_C"] = 67] = "LATIN_CAPITAL_LETTER_C";
    charset[charset["LATIN_CAPITAL_LETTER_D"] = 68] = "LATIN_CAPITAL_LETTER_D";
    charset[charset["LATIN_CAPITAL_LETTER_E"] = 69] = "LATIN_CAPITAL_LETTER_E";
    charset[charset["LATIN_CAPITAL_LETTER_F"] = 70] = "LATIN_CAPITAL_LETTER_F";
    charset[charset["LATIN_CAPITAL_LETTER_G"] = 71] = "LATIN_CAPITAL_LETTER_G";
    charset[charset["LATIN_CAPITAL_LETTER_H"] = 72] = "LATIN_CAPITAL_LETTER_H";
    charset[charset["LATIN_CAPITAL_LETTER_I"] = 73] = "LATIN_CAPITAL_LETTER_I";
    charset[charset["LATIN_CAPITAL_LETTER_J"] = 74] = "LATIN_CAPITAL_LETTER_J";
    charset[charset["LATIN_CAPITAL_LETTER_K"] = 75] = "LATIN_CAPITAL_LETTER_K";
    charset[charset["LATIN_CAPITAL_LETTER_L"] = 76] = "LATIN_CAPITAL_LETTER_L";
    charset[charset["LATIN_CAPITAL_LETTER_M"] = 77] = "LATIN_CAPITAL_LETTER_M";
    charset[charset["LATIN_CAPITAL_LETTER_N"] = 78] = "LATIN_CAPITAL_LETTER_N";
    charset[charset["LATIN_CAPITAL_LETTER_O"] = 79] = "LATIN_CAPITAL_LETTER_O";
    charset[charset["LATIN_CAPITAL_LETTER_P"] = 80] = "LATIN_CAPITAL_LETTER_P";
    charset[charset["LATIN_CAPITAL_LETTER_Q"] = 81] = "LATIN_CAPITAL_LETTER_Q";
    charset[charset["LATIN_CAPITAL_LETTER_R"] = 82] = "LATIN_CAPITAL_LETTER_R";
    charset[charset["LATIN_CAPITAL_LETTER_S"] = 83] = "LATIN_CAPITAL_LETTER_S";
    charset[charset["LATIN_CAPITAL_LETTER_T"] = 84] = "LATIN_CAPITAL_LETTER_T";
    charset[charset["LATIN_CAPITAL_LETTER_U"] = 85] = "LATIN_CAPITAL_LETTER_U";
    charset[charset["LATIN_CAPITAL_LETTER_V"] = 86] = "LATIN_CAPITAL_LETTER_V";
    charset[charset["LATIN_CAPITAL_LETTER_W"] = 87] = "LATIN_CAPITAL_LETTER_W";
    charset[charset["LATIN_CAPITAL_LETTER_X"] = 88] = "LATIN_CAPITAL_LETTER_X";
    charset[charset["LATIN_CAPITAL_LETTER_Y"] = 89] = "LATIN_CAPITAL_LETTER_Y";
    charset[charset["LATIN_CAPITAL_LETTER_Z"] = 90] = "LATIN_CAPITAL_LETTER_Z";
    charset[charset["LEFT_SQUARE_BRACKET"] = 91] = "LEFT_SQUARE_BRACKET";
    charset[charset["REVERSE_SOLIDUS"] = 92] = "REVERSE_SOLIDUS";
    charset[charset["RIGHT_SQUARE_BRACKET"] = 93] = "RIGHT_SQUARE_BRACKET";
    charset[charset["CIRCUMFLEX_ACCENT"] = 94] = "CIRCUMFLEX_ACCENT";
    charset[charset["LOW_LINE"] = 95] = "LOW_LINE";
    charset[charset["GRAVE_ACCENT"] = 96] = "GRAVE_ACCENT";
    charset[charset["LATIN_SMALL_LETTER_A"] = 97] = "LATIN_SMALL_LETTER_A";
    charset[charset["LATIN_SMALL_LETTER_B"] = 98] = "LATIN_SMALL_LETTER_B";
    charset[charset["LATIN_SMALL_LETTER_C"] = 99] = "LATIN_SMALL_LETTER_C";
    charset[charset["LATIN_SMALL_LETTER_D"] = 100] = "LATIN_SMALL_LETTER_D";
    charset[charset["LATIN_SMALL_LETTER_E"] = 101] = "LATIN_SMALL_LETTER_E";
    charset[charset["LATIN_SMALL_LETTER_F"] = 102] = "LATIN_SMALL_LETTER_F";
    charset[charset["LATIN_SMALL_LETTER_G"] = 103] = "LATIN_SMALL_LETTER_G";
    charset[charset["LATIN_SMALL_LETTER_H"] = 104] = "LATIN_SMALL_LETTER_H";
    charset[charset["LATIN_SMALL_LETTER_I"] = 105] = "LATIN_SMALL_LETTER_I";
    charset[charset["LATIN_SMALL_LETTER_J"] = 106] = "LATIN_SMALL_LETTER_J";
    charset[charset["LATIN_SMALL_LETTER_K"] = 107] = "LATIN_SMALL_LETTER_K";
    charset[charset["LATIN_SMALL_LETTER_L"] = 108] = "LATIN_SMALL_LETTER_L";
    charset[charset["LATIN_SMALL_LETTER_M"] = 109] = "LATIN_SMALL_LETTER_M";
    charset[charset["LATIN_SMALL_LETTER_N"] = 110] = "LATIN_SMALL_LETTER_N";
    charset[charset["LATIN_SMALL_LETTER_O"] = 111] = "LATIN_SMALL_LETTER_O";
    charset[charset["LATIN_SMALL_LETTER_P"] = 112] = "LATIN_SMALL_LETTER_P";
    charset[charset["LATIN_SMALL_LETTER_Q"] = 113] = "LATIN_SMALL_LETTER_Q";
    charset[charset["LATIN_SMALL_LETTER_R"] = 114] = "LATIN_SMALL_LETTER_R";
    charset[charset["LATIN_SMALL_LETTER_S"] = 115] = "LATIN_SMALL_LETTER_S";
    charset[charset["LATIN_SMALL_LETTER_T"] = 116] = "LATIN_SMALL_LETTER_T";
    charset[charset["LATIN_SMALL_LETTER_U"] = 117] = "LATIN_SMALL_LETTER_U";
    charset[charset["LATIN_SMALL_LETTER_V"] = 118] = "LATIN_SMALL_LETTER_V";
    charset[charset["LATIN_SMALL_LETTER_W"] = 119] = "LATIN_SMALL_LETTER_W";
    charset[charset["LATIN_SMALL_LETTER_X"] = 120] = "LATIN_SMALL_LETTER_X";
    charset[charset["LATIN_SMALL_LETTER_Y"] = 121] = "LATIN_SMALL_LETTER_Y";
    charset[charset["LATIN_SMALL_LETTER_Z"] = 122] = "LATIN_SMALL_LETTER_Z";
    charset[charset["LEFT_CURLY_BRACKET"] = 123] = "LEFT_CURLY_BRACKET";
    charset[charset["VERTICAL_LINE"] = 124] = "VERTICAL_LINE";
    charset[charset["RIGHT_CURLY_BRACKET"] = 125] = "RIGHT_CURLY_BRACKET";
    charset[charset["TILDE"] = 126] = "TILDE";
})(charset || (charset = {
}));
const escapedSequences = {
    [charset.QUOTATION_MARK]: charset.QUOTATION_MARK,
    [charset.REVERSE_SOLIDUS]: charset.REVERSE_SOLIDUS,
    [charset.SOLIDUS]: charset.SOLIDUS,
    [charset.LATIN_SMALL_LETTER_B]: charset.BACKSPACE,
    [charset.LATIN_SMALL_LETTER_F]: charset.FORM_FEED,
    [charset.LATIN_SMALL_LETTER_N]: charset.NEWLINE,
    [charset.LATIN_SMALL_LETTER_R]: charset.CARRIAGE_RETURN,
    [charset.LATIN_SMALL_LETTER_T]: charset.TAB
};
class NonBufferedString {
    decoder = new TextDecoder("utf-8");
    string = "";
    byteLength = 0;
    appendChar(__char) {
        this.string += String.fromCharCode(__char);
        this.byteLength += 1;
    }
    appendBuf(buf, start = 0, end = buf.length) {
        this.string += this.decoder.decode(buf.subarray(start, end));
        this.byteLength += end - start;
    }
    reset() {
        this.string = "";
        this.byteLength = 0;
    }
    toString() {
        return this.string;
    }
}
class BufferedString {
    decoder = new TextDecoder("utf-8");
    buffer;
    bufferOffset = 0;
    string = "";
    byteLength = 0;
    constructor(bufferSize){
        this.buffer = new Uint8Array(bufferSize);
    }
    appendChar(__char) {
        if (this.bufferOffset >= this.buffer.length) this.flushStringBuffer();
        this.buffer[this.bufferOffset++] = __char;
        this.byteLength += 1;
    }
    appendBuf(buf, start = 0, end = buf.length) {
        const size = end - start;
        if (this.bufferOffset + size > this.buffer.length) this.flushStringBuffer();
        this.buffer.set(buf.subarray(start, end), this.bufferOffset);
        this.bufferOffset += size;
        this.byteLength += size;
    }
    flushStringBuffer() {
        this.string += this.decoder.decode(this.buffer.subarray(0, this.bufferOffset));
        this.bufferOffset = 0;
    }
    reset() {
        this.string = "";
        this.bufferOffset = 0;
        this.byteLength = 0;
    }
    toString() {
        this.flushStringBuffer();
        return this.string;
    }
}
var TokenType;
(function(TokenType) {
    TokenType[TokenType["LEFT_BRACE"] = 1] = "LEFT_BRACE";
    TokenType[TokenType["RIGHT_BRACE"] = 2] = "RIGHT_BRACE";
    TokenType[TokenType["LEFT_BRACKET"] = 3] = "LEFT_BRACKET";
    TokenType[TokenType["RIGHT_BRACKET"] = 4] = "RIGHT_BRACKET";
    TokenType[TokenType["COLON"] = 5] = "COLON";
    TokenType[TokenType["COMMA"] = 6] = "COMMA";
    TokenType[TokenType["TRUE"] = 7] = "TRUE";
    TokenType[TokenType["FALSE"] = 8] = "FALSE";
    TokenType[TokenType["NULL"] = 9] = "NULL";
    TokenType[TokenType["STRING"] = 10] = "STRING";
    TokenType[TokenType["NUMBER"] = 11] = "NUMBER";
})(TokenType || (TokenType = {
}));
const { LEFT_BRACE , RIGHT_BRACE , LEFT_BRACKET , RIGHT_BRACKET , COLON , COMMA , TRUE , FALSE , NULL , STRING , NUMBER ,  } = TokenType;
var TokenizerStates;
(function(TokenizerStates) {
    TokenizerStates[TokenizerStates["START"] = 0] = "START";
    TokenizerStates[TokenizerStates["ENDED"] = 1] = "ENDED";
    TokenizerStates[TokenizerStates["ERROR"] = 2] = "ERROR";
    TokenizerStates[TokenizerStates["TRUE1"] = 3] = "TRUE1";
    TokenizerStates[TokenizerStates["TRUE2"] = 4] = "TRUE2";
    TokenizerStates[TokenizerStates["TRUE3"] = 5] = "TRUE3";
    TokenizerStates[TokenizerStates["FALSE1"] = 6] = "FALSE1";
    TokenizerStates[TokenizerStates["FALSE2"] = 7] = "FALSE2";
    TokenizerStates[TokenizerStates["FALSE3"] = 8] = "FALSE3";
    TokenizerStates[TokenizerStates["FALSE4"] = 9] = "FALSE4";
    TokenizerStates[TokenizerStates["NULL1"] = 10] = "NULL1";
    TokenizerStates[TokenizerStates["NULL2"] = 11] = "NULL2";
    TokenizerStates[TokenizerStates["NULL3"] = 12] = "NULL3";
    TokenizerStates[TokenizerStates["STRING_DEFAULT"] = 13] = "STRING_DEFAULT";
    TokenizerStates[TokenizerStates["STRING_AFTER_BACKSLASH"] = 14] = "STRING_AFTER_BACKSLASH";
    TokenizerStates[TokenizerStates["STRING_UNICODE_DIGIT_1"] = 15] = "STRING_UNICODE_DIGIT_1";
    TokenizerStates[TokenizerStates["STRING_UNICODE_DIGIT_2"] = 16] = "STRING_UNICODE_DIGIT_2";
    TokenizerStates[TokenizerStates["STRING_UNICODE_DIGIT_3"] = 17] = "STRING_UNICODE_DIGIT_3";
    TokenizerStates[TokenizerStates["STRING_UNICODE_DIGIT_4"] = 18] = "STRING_UNICODE_DIGIT_4";
    TokenizerStates[TokenizerStates["STRING_INCOMPLETE_CHAR"] = 19] = "STRING_INCOMPLETE_CHAR";
    TokenizerStates[TokenizerStates["NUMBER_AFTER_INITIAL_MINUS"] = 20] = "NUMBER_AFTER_INITIAL_MINUS";
    TokenizerStates[TokenizerStates["NUMBER_AFTER_INITIAL_ZERO"] = 21] = "NUMBER_AFTER_INITIAL_ZERO";
    TokenizerStates[TokenizerStates["NUMBER_AFTER_INITIAL_NON_ZERO"] = 22] = "NUMBER_AFTER_INITIAL_NON_ZERO";
    TokenizerStates[TokenizerStates["NUMBER_AFTER_FULL_STOP"] = 23] = "NUMBER_AFTER_FULL_STOP";
    TokenizerStates[TokenizerStates["NUMBER_AFTER_DECIMAL"] = 24] = "NUMBER_AFTER_DECIMAL";
    TokenizerStates[TokenizerStates["NUMBER_AFTER_E"] = 25] = "NUMBER_AFTER_E";
    TokenizerStates[TokenizerStates["NUMBER_AFTER_E_AND_SIGN"] = 26] = "NUMBER_AFTER_E_AND_SIGN";
    TokenizerStates[TokenizerStates["NUMBER_AFTER_E_AND_DIGIT"] = 27] = "NUMBER_AFTER_E_AND_DIGIT";
})(TokenizerStates || (TokenizerStates = {
}));
const defaultOpts = {
    stringBufferSize: 0,
    numberBufferSize: 0
};
class TokenizerError extends Error {
    constructor(message){
        super(message);
        Object.setPrototypeOf(this, TokenizerError.prototype);
    }
}
class Tokenizer {
    state = TokenizerStates.START;
    bufferedString;
    bufferedNumber;
    unicode = undefined;
    highSurrogate = undefined;
    bytes_remaining = 0;
    bytes_in_sequence = 0;
    char_split_buffer = new Uint8Array(4);
    encoder = new TextEncoder();
    offset = -1;
    constructor(opts){
        opts = {
            ...defaultOpts,
            ...opts
        };
        this.bufferedString = opts.stringBufferSize && opts.stringBufferSize > 4 ? new BufferedString(opts.stringBufferSize) : new NonBufferedString();
        this.bufferedNumber = opts.numberBufferSize && opts.numberBufferSize > 0 ? new BufferedString(opts.numberBufferSize) : new NonBufferedString();
    }
    write(input) {
        let buffer;
        if (input instanceof Uint8Array) {
            buffer = input;
        } else if (typeof input === "string") {
            buffer = this.encoder.encode(input);
        } else if (input.buffer || Array.isArray(input)) {
            buffer = Uint8Array.from(input);
        } else {
            this.error(new TypeError("Unexpected type. The `write` function only accepts TypeArrays and Strings."));
        }
        for(var i = 0; i < buffer.length; i += 1){
            const n = buffer[i];
            switch(this.state){
                case TokenizerStates.START:
                    this.offset += 1;
                    if (n === charset.SPACE || n === charset.NEWLINE || n === charset.CARRIAGE_RETURN || n === charset.TAB) {
                        continue;
                    }
                    if (n === charset.LEFT_CURLY_BRACKET) {
                        this.onToken(LEFT_BRACE, "{", this.offset);
                        continue;
                    }
                    if (n === charset.RIGHT_CURLY_BRACKET) {
                        this.onToken(RIGHT_BRACE, "}", this.offset);
                        continue;
                    }
                    if (n === charset.LEFT_SQUARE_BRACKET) {
                        this.onToken(LEFT_BRACKET, "[", this.offset);
                        continue;
                    }
                    if (n === charset.RIGHT_SQUARE_BRACKET) {
                        this.onToken(RIGHT_BRACKET, "]", this.offset);
                        continue;
                    }
                    if (n === charset.COLON) {
                        this.onToken(COLON, ":", this.offset);
                        continue;
                    }
                    if (n === charset.COMMA) {
                        this.onToken(COMMA, ",", this.offset);
                        continue;
                    }
                    if (n === charset.LATIN_SMALL_LETTER_T) {
                        this.state = TokenizerStates.TRUE1;
                        continue;
                    }
                    if (n === charset.LATIN_SMALL_LETTER_F) {
                        this.state = TokenizerStates.FALSE1;
                        continue;
                    }
                    if (n === charset.LATIN_SMALL_LETTER_N) {
                        this.state = TokenizerStates.NULL1;
                        continue;
                    }
                    if (n === charset.QUOTATION_MARK) {
                        this.bufferedString.reset();
                        this.state = TokenizerStates.STRING_DEFAULT;
                        continue;
                    }
                    if (n >= charset.DIGIT_ONE && n <= charset.DIGIT_NINE) {
                        this.bufferedNumber.reset();
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_INITIAL_NON_ZERO;
                        continue;
                    }
                    if (n === charset.DIGIT_ZERO) {
                        this.bufferedNumber.reset();
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_INITIAL_ZERO;
                        continue;
                    }
                    if (n === charset.HYPHEN_MINUS) {
                        this.bufferedNumber.reset();
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_INITIAL_MINUS;
                        continue;
                    }
                    break;
                case TokenizerStates.STRING_DEFAULT:
                    if (n === charset.QUOTATION_MARK) {
                        const string = this.bufferedString.toString();
                        this.state = TokenizerStates.START;
                        this.onToken(STRING, string, this.offset);
                        this.offset += this.bufferedString.byteLength + 1;
                        continue;
                    }
                    if (n === charset.REVERSE_SOLIDUS) {
                        this.state = TokenizerStates.STRING_AFTER_BACKSLASH;
                        continue;
                    }
                    if (n >= 128) {
                        if (n >= 194 && n <= 223) {
                            this.bytes_in_sequence = 2;
                        } else if (n <= 239) {
                            this.bytes_in_sequence = 3;
                        } else {
                            this.bytes_in_sequence = 4;
                        }
                        if (this.bytes_in_sequence <= buffer.length - i) {
                            this.bufferedString.appendBuf(buffer, i, i + this.bytes_in_sequence);
                            i += this.bytes_in_sequence - 1;
                            continue;
                        }
                        this.bytes_remaining = i + this.bytes_in_sequence - buffer.length;
                        this.char_split_buffer.set(buffer.subarray(i));
                        i = buffer.length - 1;
                        this.state = TokenizerStates.STRING_INCOMPLETE_CHAR;
                        continue;
                    }
                    if (n >= charset.SPACE) {
                        this.bufferedString.appendChar(n);
                        continue;
                    }
                    break;
                case TokenizerStates.STRING_INCOMPLETE_CHAR:
                    this.char_split_buffer.set(buffer.subarray(i, i + this.bytes_remaining), this.bytes_in_sequence - this.bytes_remaining);
                    this.bufferedString.appendBuf(this.char_split_buffer, 0, this.bytes_in_sequence);
                    i = this.bytes_remaining - 1;
                    this.state = TokenizerStates.STRING_DEFAULT;
                    continue;
                case TokenizerStates.STRING_AFTER_BACKSLASH:
                    const controlChar = escapedSequences[n];
                    if (controlChar) {
                        this.bufferedString.appendChar(controlChar);
                        this.state = TokenizerStates.STRING_DEFAULT;
                        continue;
                    }
                    if (n === charset.LATIN_SMALL_LETTER_U) {
                        this.unicode = "";
                        this.state = TokenizerStates.STRING_UNICODE_DIGIT_1;
                        continue;
                    }
                    break;
                case TokenizerStates.STRING_UNICODE_DIGIT_1:
                case TokenizerStates.STRING_UNICODE_DIGIT_2:
                case TokenizerStates.STRING_UNICODE_DIGIT_3:
                    if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE || n >= charset.LATIN_CAPITAL_LETTER_A && n <= charset.LATIN_CAPITAL_LETTER_F || n >= charset.LATIN_SMALL_LETTER_A && n <= charset.LATIN_SMALL_LETTER_F) {
                        this.unicode += String.fromCharCode(n);
                        this.state += 1;
                        continue;
                    }
                    break;
                case TokenizerStates.STRING_UNICODE_DIGIT_4:
                    if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE || n >= charset.LATIN_CAPITAL_LETTER_A && n <= charset.LATIN_CAPITAL_LETTER_F || n >= charset.LATIN_SMALL_LETTER_A && n <= charset.LATIN_SMALL_LETTER_F) {
                        const intVal = parseInt(this.unicode + String.fromCharCode(n), 16);
                        if (this.highSurrogate === undefined) {
                            if (intVal >= 55296 && intVal <= 56319) {
                                this.highSurrogate = intVal;
                            } else {
                                this.bufferedString.appendBuf(this.encoder.encode(String.fromCharCode(intVal)));
                            }
                        } else {
                            if (intVal >= 56320 && intVal <= 57343) {
                                this.bufferedString.appendBuf(this.encoder.encode(String.fromCharCode(this.highSurrogate, intVal)));
                            } else {
                                this.bufferedString.appendBuf(this.encoder.encode(String.fromCharCode(this.highSurrogate)));
                            }
                            this.highSurrogate = undefined;
                        }
                        this.state = TokenizerStates.STRING_DEFAULT;
                        continue;
                    }
                case TokenizerStates.NUMBER_AFTER_INITIAL_MINUS:
                    if (n === charset.DIGIT_ZERO) {
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_INITIAL_ZERO;
                        continue;
                    }
                    if (n >= charset.DIGIT_ONE && n <= charset.DIGIT_NINE) {
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_INITIAL_NON_ZERO;
                        continue;
                    }
                    break;
                case TokenizerStates.NUMBER_AFTER_INITIAL_ZERO:
                    if (n === charset.FULL_STOP) {
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_FULL_STOP;
                        continue;
                    }
                    if (n === charset.LATIN_SMALL_LETTER_E || n === charset.LATIN_CAPITAL_LETTER_E) {
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_E;
                        continue;
                    }
                    i -= 1;
                    this.state = TokenizerStates.START;
                    this.emitNumber();
                    continue;
                case TokenizerStates.NUMBER_AFTER_INITIAL_NON_ZERO:
                    if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
                        this.bufferedNumber.appendChar(n);
                        continue;
                    }
                    if (n === charset.FULL_STOP) {
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_FULL_STOP;
                        continue;
                    }
                    if (n === charset.LATIN_SMALL_LETTER_E || n === charset.LATIN_CAPITAL_LETTER_E) {
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_E;
                        continue;
                    }
                    i -= 1;
                    this.state = TokenizerStates.START;
                    this.emitNumber();
                    continue;
                case TokenizerStates.NUMBER_AFTER_FULL_STOP:
                    if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_DECIMAL;
                        continue;
                    }
                    break;
                case TokenizerStates.NUMBER_AFTER_DECIMAL:
                    if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
                        this.bufferedNumber.appendChar(n);
                        continue;
                    }
                    if (n === charset.LATIN_SMALL_LETTER_E || n === charset.LATIN_CAPITAL_LETTER_E) {
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_E;
                        continue;
                    }
                    i -= 1;
                    this.state = TokenizerStates.START;
                    this.emitNumber();
                    continue;
                case TokenizerStates.NUMBER_AFTER_E:
                    if (n === charset.PLUS_SIGN || n === charset.HYPHEN_MINUS) {
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_E_AND_SIGN;
                        continue;
                    }
                case TokenizerStates.NUMBER_AFTER_E_AND_SIGN:
                    if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
                        this.bufferedNumber.appendChar(n);
                        this.state = TokenizerStates.NUMBER_AFTER_E_AND_DIGIT;
                        continue;
                    }
                    break;
                case TokenizerStates.NUMBER_AFTER_E_AND_DIGIT:
                    if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
                        this.bufferedNumber.appendChar(n);
                        continue;
                    }
                    i -= 1;
                    this.state = TokenizerStates.START;
                    this.emitNumber();
                    continue;
                case TokenizerStates.TRUE1:
                    if (n === charset.LATIN_SMALL_LETTER_R) {
                        this.state = TokenizerStates.TRUE2;
                        continue;
                    }
                    break;
                case TokenizerStates.TRUE2:
                    if (n === charset.LATIN_SMALL_LETTER_U) {
                        this.state = TokenizerStates.TRUE3;
                        continue;
                    }
                    break;
                case TokenizerStates.TRUE3:
                    if (n === charset.LATIN_SMALL_LETTER_E) {
                        this.state = TokenizerStates.START;
                        this.onToken(TRUE, true, this.offset);
                        this.offset += 3;
                        continue;
                    }
                    break;
                case TokenizerStates.FALSE1:
                    if (n === charset.LATIN_SMALL_LETTER_A) {
                        this.state = TokenizerStates.FALSE2;
                        continue;
                    }
                    break;
                case TokenizerStates.FALSE2:
                    if (n === charset.LATIN_SMALL_LETTER_L) {
                        this.state = TokenizerStates.FALSE3;
                        continue;
                    }
                    break;
                case TokenizerStates.FALSE3:
                    if (n === charset.LATIN_SMALL_LETTER_S) {
                        this.state = TokenizerStates.FALSE4;
                        continue;
                    }
                    break;
                case TokenizerStates.FALSE4:
                    if (n === charset.LATIN_SMALL_LETTER_E) {
                        this.state = TokenizerStates.START;
                        this.onToken(FALSE, false, this.offset);
                        this.offset += 4;
                        continue;
                    }
                    break;
                case TokenizerStates.NULL1:
                    if (n === charset.LATIN_SMALL_LETTER_U) {
                        this.state = TokenizerStates.NULL2;
                        continue;
                    }
                    break;
                case TokenizerStates.NULL2:
                    if (n === charset.LATIN_SMALL_LETTER_L) {
                        this.state = TokenizerStates.NULL3;
                        continue;
                    }
                    break;
                case TokenizerStates.NULL3:
                    if (n === charset.LATIN_SMALL_LETTER_L) {
                        this.state = TokenizerStates.START;
                        this.onToken(NULL, null, this.offset);
                        this.offset += 3;
                        continue;
                    }
                    break;
            }
            this.error(new TokenizerError(`Unexpected "${String.fromCharCode(n)}" at position "${i}" in state ${TokenizerStates[this.state]}`));
        }
    }
    emitNumber() {
        this.onToken(NUMBER, this.parseNumber(this.bufferedNumber.toString()), this.offset);
        this.offset += this.bufferedNumber.byteLength - 1;
    }
    parseNumber(numberStr) {
        return Number(numberStr);
    }
    error(err) {
        this.state = TokenizerStates.ERROR;
        throw err;
    }
    end() {
        if (this.state !== TokenizerStates.START) {
            this.error(new TokenizerError(`Tokenizer ended in the middle of a token (state: ${TokenizerStates[this.state]}). Either not all the data was received or the data was invalid.`));
        }
        this.state = TokenizerStates.ENDED;
    }
    onToken(token, value, offset) {
    }
}
const { LEFT_BRACE: LEFT_BRACE1 , RIGHT_BRACE: RIGHT_BRACE1 , LEFT_BRACKET: LEFT_BRACKET1 , RIGHT_BRACKET: RIGHT_BRACKET1 , COLON: COLON1 , COMMA: COMMA1 , TRUE: TRUE1 , FALSE: FALSE1 , NULL: NULL1 , STRING: STRING1 , NUMBER: NUMBER1 ,  } = TokenType;
var ParserState;
(function(ParserState) {
    ParserState[ParserState["VALUE"] = 0] = "VALUE";
    ParserState[ParserState["KEY"] = 1] = "KEY";
    ParserState[ParserState["COLON"] = 2] = "COLON";
    ParserState[ParserState["COMMA"] = 3] = "COMMA";
    ParserState[ParserState["ENDED"] = 4] = "ENDED";
    ParserState[ParserState["ERROR"] = 5] = "ERROR";
})(ParserState || (ParserState = {
}));
var ParserMode;
(function(ParserMode) {
    ParserMode[ParserMode["OBJECT"] = 0] = "OBJECT";
    ParserMode[ParserMode["ARRAY"] = 1] = "ARRAY";
})(ParserMode || (ParserMode = {
}));
const defaultOpts1 = {
    paths: undefined,
    keepStack: true
};
class TokenParserError extends Error {
    constructor(message){
        super(message);
        Object.setPrototypeOf(this, TokenParserError.prototype);
    }
}
class Parser {
    paths;
    keepStack;
    state = ParserState.VALUE;
    mode = undefined;
    key = undefined;
    value = undefined;
    stack = [];
    constructor(opts){
        opts = {
            ...defaultOpts1,
            ...opts
        };
        if (opts.paths) {
            this.paths = opts.paths.map((path)=>{
                if (path === undefined || path === '$*') return undefined;
                if (!path.startsWith('$')) throw new TokenParserError(`Invalid selector "${path}". Should start with "$".`);
                const pathParts = path.split('.').slice(1);
                if (pathParts.includes('')) throw new TokenParserError(`Invalid selector "${path}". ".." syntax not supported.`);
                return pathParts;
            });
        }
        this.keepStack = opts.keepStack;
    }
    shouldEmit() {
        if (!this.paths) return true;
        return this.paths.some((path)=>{
            if (path === undefined) return true;
            if (path.length !== this.stack.length) return false;
            for(let i = 0; i < path.length - 1; i++){
                const selector = path[i];
                const key = this.stack[i + 1].key;
                if (selector === '*') continue;
                if (selector !== key) return false;
            }
            const selector = path[path.length - 1];
            if (selector === '*') return true;
            return selector === this.key?.toString();
        });
    }
    push() {
        this.stack.push({
            key: this.key,
            value: this.value,
            mode: this.mode,
            emit: this.shouldEmit()
        });
    }
    pop() {
        const value = this.value;
        let emit;
        ({ key: this.key , value: this.value , mode: this.mode , emit  } = this.stack.pop());
        this.emit(value, emit);
        this.state = this.mode !== undefined ? ParserState.COMMA : ParserState.VALUE;
    }
    emit(value, emit) {
        if (this.value && !this.keepStack && this.stack.every((item)=>!item.emit
        )) {
            delete this.value[this.key];
        }
        if (emit) {
            this.onValue(value, this.key, this.value, this.stack);
        }
    }
    write(token, value) {
        if (this.state === ParserState.VALUE) {
            if (token === STRING1 || token === NUMBER1 || token === TRUE1 || token === FALSE1 || token === NULL1) {
                if (this.mode === ParserMode.OBJECT) {
                    this.value[this.key] = value;
                    this.state = ParserState.COMMA;
                } else if (this.mode === ParserMode.ARRAY) {
                    this.value.push(value);
                    this.state = ParserState.COMMA;
                }
                this.emit(value, this.shouldEmit());
                return;
            }
            if (token === LEFT_BRACE1) {
                this.push();
                if (this.mode === ParserMode.OBJECT) {
                    this.value = this.value[this.key] = {
                    };
                } else if (this.mode === ParserMode.ARRAY) {
                    const val = {
                    };
                    this.value.push(val);
                    this.value = val;
                } else {
                    this.value = {
                    };
                }
                this.mode = ParserMode.OBJECT;
                this.state = ParserState.KEY;
                this.key = undefined;
                return;
            }
            if (token === LEFT_BRACKET1) {
                this.push();
                if (this.mode === ParserMode.OBJECT) {
                    this.value = this.value[this.key] = [];
                } else if (this.mode === ParserMode.ARRAY) {
                    const val = [];
                    this.value.push(val);
                    this.value = val;
                } else {
                    this.value = [];
                }
                this.mode = ParserMode.ARRAY;
                this.state = ParserState.VALUE;
                this.key = 0;
                return;
            }
            if (this.mode === ParserMode.ARRAY && token === RIGHT_BRACKET1 && this.value.length === 0) {
                this.pop();
                return;
            }
        }
        if (this.state === ParserState.KEY) {
            if (token === STRING1) {
                this.key = value;
                this.state = ParserState.COLON;
                return;
            }
            if (token === RIGHT_BRACE1 && Object.keys(this.value).length === 0) {
                this.pop();
                return;
            }
        }
        if (this.state === ParserState.COLON) {
            if (token === COLON1) {
                this.state = ParserState.VALUE;
                return;
            }
        }
        if (this.state === ParserState.COMMA) {
            if (token === COMMA1) {
                if (this.mode === ParserMode.ARRAY) {
                    this.state = ParserState.VALUE;
                    this.key += 1;
                    return;
                }
                if (this.mode === ParserMode.OBJECT) {
                    this.state = ParserState.KEY;
                    return;
                }
            }
            if (token === RIGHT_BRACE1 && this.mode === ParserMode.OBJECT || token === RIGHT_BRACKET1 && this.mode === ParserMode.ARRAY) {
                this.pop();
                return;
            }
        }
        this.error(new TokenParserError(`Unexpected ${TokenType[token]} (${JSON.stringify(value)}) in state ${ParserState[this.state]}`));
    }
    error(err) {
        this.state = ParserState.ERROR;
        throw err;
    }
    end() {
        if (this.state !== ParserState.VALUE || this.stack.length > 0) {
            this.error(new TokenParserError(`Parser ended in mid-parsing (state: ${ParserState[this.state]}). Either not all the data was received or the data was invalid.`));
        }
        this.state = ParserState.ENDED;
    }
    onValue(value, key, parent, stack) {
    }
}
class JSONParser {
    tokenizer;
    parser;
    constructor(opts = {
    }){
        this.tokenizer = new Tokenizer(opts);
        this.parser = new Parser(opts);
        this.tokenizer.onToken = this.parser.write.bind(this.parser);
    }
    write(input) {
        try {
            this.tokenizer.write(input);
        } catch (err) {
            if (err instanceof TokenParserError) {
                this.tokenizer.error(err);
            }
            throw err;
        }
    }
    set onToken(cb) {
        this.tokenizer.onToken = cb;
    }
    set onValue(cb) {
        this.parser.onValue = cb;
    }
    end() {
        this.parser.end();
        this.tokenizer.end();
    }
}
function isMessage(data) {
    return Array.isArray(data) && data.length === 2 && typeof data[0] === "number" && typeof data[1] !== "undefined";
}
class Indexer1 {
    #max;
    #val;
    constructor(max){
        if (max != null && max < 2) {
            throw new Error(`The attribute 'max' must be greater than 1 but ${max} has specified`);
        }
        this.#max = max ?? Number.MAX_SAFE_INTEGER;
        this.#val = -1;
    }
    next() {
        if (this.#val >= this.#max) {
            this.#val = -1;
        }
        this.#val += 1;
        return this.#val;
    }
}
class TimeoutError1 extends Error {
    constructor(){
        super("the process didn't complete in time");
        this.name = "TimeoutError";
    }
}
class ResponseWaiter1 {
    #waiters;
    #timeout;
    constructor(timeout = 10000){
        this.#waiters = new Map();
        this.#timeout = timeout;
    }
    get waiterCount() {
        return this.#waiters.size;
    }
    wait(msgid, timeout) {
        let response = this.#waiters.get(msgid)?.response;
        if (!response) {
            response = deferred3();
            const timer = setTimeout(()=>{
                const response = this.#waiters.get(msgid)?.response;
                if (!response) {
                    return;
                }
                response.reject(new TimeoutError1());
                this.#waiters.delete(msgid);
            }, timeout ?? this.#timeout);
            this.#waiters.set(msgid, {
                timer,
                response
            });
        }
        return response;
    }
    provide(message) {
        const [msgid, _data] = message;
        const waiter = this.#waiters.get(msgid);
        if (!waiter) {
            return false;
        }
        this.#waiters.delete(msgid);
        const { timer , response  } = waiter;
        clearTimeout(timer);
        response.resolve(message);
        return true;
    }
}
const MSGID_THRESHOLD1 = 2 ** 32;
const BUFFER_SIZE = 32 * 1024;
const utf8Encoder = new TextEncoder();
class Session1 {
    #indexer;
    #waiter;
    #reader;
    #writer;
    #callback;
    #listener;
    #closed;
    #closedSignal;
    constructor(reader, writer, callback = ()=>undefined
    , options = {
    }){
        this.#indexer = new Indexer1(MSGID_THRESHOLD1);
        this.#waiter = new ResponseWaiter1(options.responseTimeout);
        this.#reader = reader;
        this.#writer = writer;
        this.#callback = callback;
        this.#closed = false;
        this.#closedSignal = deferred3();
        this.#listener = this.listen().catch((e)=>{
            if (options.errorCallback) {
                options.errorCallback(e);
            } else {
                console.error(`Unexpected error occured in session: ${e}`);
            }
        });
    }
    nextMsgid() {
        const msgid = this.#indexer.next() * -1;
        return msgid;
    }
    async send(data) {
        await mod4.writeAll(this.#writer, utf8Encoder.encode(JSON.stringify(data)));
    }
    async listen() {
        const parser = new JSONParser();
        parser.onValue = (data, _key, _parent, stack)=>{
            if (stack.length > 0) {
                return;
            }
            if (!isMessage(data)) {
                console.warn(`Unexpected data received: ${data}`);
                return;
            }
            if (!this.#waiter.provide(data)) {
                this.#callback.apply(this, [
                    data
                ]);
                return;
            }
        };
        try {
            const buf = new Uint8Array(BUFFER_SIZE);
            while(!this.#closed){
                const n = await Promise.race([
                    this.#closedSignal,
                    this.#reader.read(buf), 
                ]);
                if (n == null) {
                    break;
                }
                parser.write(buf.subarray(0, n));
            }
        } catch (e) {
            if (e instanceof SessionClosedError1) {
                return;
            }
            if (e instanceof Deno.errors.BadResource) {
                return;
            }
            throw e;
        }
    }
    dispose() {
        this.close();
    }
    close() {
        this.#closed = true;
        this.#closedSignal.reject(new SessionClosedError1());
    }
    waitClosed() {
        return this.#listener;
    }
    async reply(msgid, expr) {
        if (this.#closed) {
            throw new SessionClosedError1();
        }
        const data = [
            msgid,
            expr
        ];
        await this.send(data);
    }
    async redraw(force = false) {
        if (this.#closed) {
            throw new SessionClosedError1();
        }
        const data = [
            "redraw",
            force ? "force" : ""
        ];
        await this.send(data);
    }
    async ex(expr) {
        if (this.#closed) {
            throw new SessionClosedError1();
        }
        const data = [
            "ex",
            expr
        ];
        await this.send(data);
    }
    async normal(expr) {
        if (this.#closed) {
            throw new SessionClosedError1();
        }
        const data = [
            "normal",
            expr
        ];
        await this.send(data);
    }
    async expr(expr) {
        if (this.#closed) {
            throw new SessionClosedError1();
        }
        const msgid = this.nextMsgid();
        const data = [
            "expr",
            expr,
            msgid
        ];
        const [_, response] = await Promise.all([
            this.send(data),
            this.#waiter.wait(msgid), 
        ]);
        return response[1];
    }
    async exprNoReply(expr) {
        if (this.#closed) {
            throw new SessionClosedError1();
        }
        const data = [
            "expr",
            expr
        ];
        await this.send(data);
    }
    async call(fn, ...args) {
        if (this.#closed) {
            throw new SessionClosedError1();
        }
        const msgid = this.nextMsgid();
        const data = [
            "call",
            fn,
            args,
            msgid
        ];
        const [_, response] = await Promise.all([
            this.send(data),
            this.#waiter.wait(msgid), 
        ]);
        return response[1];
    }
    async callNoReply(fn, ...args) {
        if (this.#closed) {
            throw new SessionClosedError1();
        }
        const data = [
            "call",
            fn,
            args
        ];
        await this.send(data);
    }
    replaceCallback(callback) {
        this.#callback = callback;
    }
}
class SessionClosedError1 extends Error {
    constructor(){
        super("The session is closed");
        this.name = "SessionClosedError";
    }
}
async function using(resource, fn) {
    try {
        return await fn(resource);
    } finally{
        await resource.dispose();
    }
}
const responseTimeout = 60 * 60 * 24 * 7;
class Invoker {
    #service;
    constructor(service){
        this.#service = service;
    }
    register(name, script, meta, options) {
        this.#service.register(name, script, meta, options);
    }
    dispatch(name, fn, args) {
        return this.#service.dispatch(name, fn, args);
    }
    dispatchAsync(name, fn, args, success, failure) {
        this.#service.dispatch(name, fn, args).then(async (r)=>{
            try {
                await this.#service.call("denops#callback#call", success, r);
            } catch (e) {
                console.error(`${e.stack ?? e.toString()}`);
            }
        }).catch(async (e)=>{
            try {
                await this.#service.call("denops#callback#call", failure, toErrorObject(e));
            } catch (e1) {
                console.error(`${e1.stack ?? e1.toString()}`);
            }
        });
        return Promise.resolve();
    }
}
function isInvokerMethod(value) {
    return value in Invoker.prototype;
}
function toErrorObject(err) {
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack
        };
    }
    return {
        name: typeof err,
        message: `${err}`
    };
}
const workerScript = "./worker/script.bundle.js";
class Service {
    #plugins;
    #host;
    constructor(host){
        this.#plugins = new Map();
        this.#host = host;
        this.#host.register(new Invoker(this));
    }
    register(name, script, meta, options) {
        const plugin = this.#plugins.get(name);
        if (plugin) {
            if (options.mode === "reload") {
                if (meta.mode === "debug") {
                    console.log(`A denops plugin '${name}' is already registered. Reload`);
                }
                plugin.worker.terminate();
            } else if (options.mode === "skip") {
                if (meta.mode === "debug") {
                    console.log(`A denops plugin '${name}' is already registered. Skip`);
                }
                return;
            } else {
                throw new Error(`A denops plugin '${name}' is already registered`);
            }
        }
        const worker = new Worker(new URL(workerScript, Deno.mainModule).href, {
            name,
            type: "module",
            deno: {
                namespace: true
            }
        });
        worker.postMessage({
            name,
            script,
            meta
        });
        const reader = new WorkerReader(worker);
        const writer = new WorkerWriter(worker);
        const session = new Session(reader, writer, {
            call: async (fn, ...args)=>{
                ensureString(fn);
                ensureArray(args);
                return await this.call(fn, ...args);
            },
            batch: async (...calls)=>{
                const isCall = (call)=>isArray(call) && call.length > 0 && isString(call[0])
                ;
                ensureArray(calls, isCall);
                return await this.batch(...calls);
            },
            dispatch: async (name, fn, ...args)=>{
                ensureString(name);
                ensureString(fn);
                ensureArray(args);
                return await this.dispatch(name, fn, args);
            }
        }, {
            responseTimeout
        });
        this.#plugins.set(name, {
            session,
            worker
        });
    }
    async call(fn, ...args) {
        return await this.#host.call(fn, ...args);
    }
    async batch(...calls) {
        return await this.#host.batch(...calls);
    }
    async dispatch(name, fn, args) {
        try {
            const plugin = this.#plugins.get(name);
            if (!plugin) {
                throw new Error(`No plugin '${name}' is registered`);
            }
            return await plugin.session.call(fn, ...args);
        } catch (e) {
            throw `${e.stack ?? e.toString()}`;
        }
    }
    waitClosed() {
        return this.#host.waitClosed();
    }
}
class Vim {
    #session;
    constructor(reader, writer){
        this.#session = new Session1(reader, writer, undefined, {
            responseTimeout
        });
    }
    async call(fn, ...args) {
        const [ret, err] = await this.#session.call("denops#api#vim#call", fn, args);
        if (err !== "") {
            throw new Error(`Failed to call '${fn}(${args.join(", ")})': ${err}`);
        }
        return ret;
    }
    async batch(...calls) {
        return await this.#session.call("denops#api#vim#batch", calls);
    }
    register(invoker) {
        this.#session.replaceCallback(async (message)=>{
            const [msgid, expr] = message;
            let ok = null;
            let err = null;
            try {
                ok = await dispatch(invoker, expr);
            } catch (e) {
                err = e;
            }
            if (msgid !== 0) {
                await this.#session.reply(msgid, [
                    ok,
                    err
                ]);
            } else if (err !== null) {
                console.error(err);
            }
        });
    }
    waitClosed() {
        return this.#session.waitClosed();
    }
    dispose() {
        this.#session.dispose();
    }
}
async function dispatch(invoker, expr) {
    if (isInvokeMessage(expr)) {
        const [_, method, args] = expr;
        if (!isInvokerMethod(method)) {
            throw new Error(`Method '${method}' is not defined in the invoker`);
        }
        return await invoker[method](...args);
    } else {
        throw new Error(`Unexpected JSON channel message is received: ${JSON.stringify(expr)}`);
    }
}
function isInvokeMessage(data) {
    return Array.isArray(data) && data.length === 3 && data[0] === "invoke" && typeof data[1] === "string" && Array.isArray(data[2]);
}
class Neovim {
    #session;
    constructor(reader, writer){
        this.#session = new Session(reader, writer, undefined, {
            responseTimeout
        });
    }
    call(fn, ...args) {
        return this.#session.call("nvim_call_function", fn, args);
    }
    async batch(...calls) {
        const [ret, err] = await this.#session.call("nvim_call_atomic", calls.map(([fn, ...args])=>[
                "nvim_call_function",
                [
                    fn,
                    args
                ]
            ]
        ));
        if (err) {
            return [
                ret,
                err[2]
            ];
        }
        return [
            ret,
            ""
        ];
    }
    register(invoker) {
        this.#session.dispatcher = {
            async invoke (method, args) {
                ensureString(method);
                ensureArray(args);
                if (!isInvokerMethod(method)) {
                    throw new Error(`Method '${method}' is not defined in the invoker`);
                }
                return await invoker[method](...args);
            }
        };
    }
    waitClosed() {
        return this.#session.waitClosed();
    }
    dispose() {
        this.#session.dispose();
    }
}
const textDecoder = new TextDecoder();
class TraceReader {
    #reader;
    constructor(reader){
        this.#reader = reader;
    }
    close() {
        this.#reader.close();
    }
    async read(p) {
        const n = await this.#reader.read(p);
        if (n) {
            const value = p.subarray(0, n);
            try {
                console.log("r:", textDecoder.decode(value));
            } catch  {
                console.log("r:", value);
            }
        }
        return n;
    }
}
class TraceWriter {
    #writer;
    constructor(writer){
        this.#writer = writer;
    }
    async write(p) {
        const n = await this.#writer.write(p);
        const value = p.subarray(0, n);
        try {
            console.log("w:", textDecoder.decode(value));
        } catch  {
            console.log("w:", value);
        }
        return n;
    }
}
const opts = mod.parse(Deno.args);
if (!opts.mode) {
    throw new Error("No `--mode` option is specified.");
}
const listener = Deno.listen({
    hostname: "127.0.0.1",
    port: 0
});
const addr = listener.addr;
console.log(`${addr.hostname}:${addr.port}`);
for await (const conn of listener){
    const reader = opts.trace ? new TraceReader(conn) : conn;
    const writer = opts.trace ? new TraceWriter(conn) : conn;
    const hostClass = opts.mode === "vim" ? Vim : Neovim;
    await using(new hostClass(reader, writer), async (host)=>{
        const service = new Service(host);
        await service.waitClosed();
    });
    break;
}
