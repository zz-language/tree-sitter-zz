// tree-sitter-zz — Tree-sitter grammar for the ZZ programming language
//
// Mirrors the authoritative lexer:
//   zz_lang/crates/zz_frontend/src/token.rs + lexer/mod.rs
// Newlines are whitespace here (no StmtEnd tracking): this grammar targets
// highlighting, folding, indentation and Linguist classification — not
// compilation. `;` is accepted as an empty statement.

/// <reference https://tree-sitter.github.io/tree-sitter />

module.exports = grammar({
  name: "zz",

  word: ($) => $.identifier,

  extras: ($) => [/\s/, $.line_comment, $.block_comment],

  rules: {
    source_file: ($) => repeat($._item),

    _item: ($) =>
      choice(
        $.import_statement,
        $.function_definition,
        $.struct_definition,
        $.impl_block,
        $.const_definition,
        $.extern_block,
        $._statement,
      ),

    // ── Imports ─────────────────────────────────────────────────────────
    import_statement: ($) =>
      seq(
        "import",
        field("module", $.module_path),
        optional(seq("as", field("alias", $.identifier))),
      ),

    module_path: ($) => token(/[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/),
    decorator: ($) => seq("@", $.identifier),

    // ── Top-level definitions ───────────────────────────────────────────
    function_definition: ($) =>
      seq(
        repeat($.decorator),
        optional("pub"),
        "func",
        field("name", $.identifier),
        field("parameters", $.parameter_list),
        optional(seq("->", field("return_type", $._type))),
        field("body", $.block),
      ),

    parameter_list: ($) => seq("(", optional(commaSep($.parameter)), ")"),

    parameter: ($) =>
      seq(field("name", $.identifier), optional(seq(":", field("type", $._type)))),

    struct_definition: ($) =>
      seq(
        optional("pub"),
        "struct",
        field("name", $.type_identifier),
        "{",
        repeat(seq($.identifier, ":", $._type, optional(","))),
        "}",
      ),

    impl_block: ($) =>
      seq(
        optional("pub"),
        "impl",
        field("name", $.type_identifier),
        "{",
        repeat($.function_definition),
        "}",
      ),

    const_definition: ($) =>
      seq(optional("pub"), "const", field("name", $.identifier), optional(seq(":", $._type)), "=", $._expression),

    extern_block: ($) => seq("extern", '"', /[^"]*/, '"', "{", repeat($._extern_item), "}"),

    _extern_item: ($) => seq("func", $.identifier, $.parameter_list, optional(seq("->", $._type)), ";"),

    // ── Types ───────────────────────────────────────────────────────────
    _type: ($) =>
      choice(
        $.primitive_type,
        $.named_type,
        $.array_type,
        $.dict_type,
        $.union_type,
        $.option_type,
        $.tuple_type,
        $.pointer_type,
        $.function_type,
      ),

    primitive_type: (_) => choice("int", "float", "bool", "str", "unit", "void"),

    // ZZ type names are often lowercase (http.server, http.request):
    // Capitalized is conventional, not required.
    named_type: ($) =>
      seq(
        field("scope", optional(seq($.identifier, "."))),
        field("name", choice($.type_identifier, $.identifier)),
        optional(seq("<", commaSep1($._type), ">"))),

    type_identifier: (_) => /[A-Z][A-Za-z0-9_]*/,

    array_type: ($) => seq("[", $._type, "]"),

    dict_type: ($) => seq("{", $._type, ":", $._type, "}"),

    union_type: ($) => prec.left(1, seq($._type, "|", $._type)),

    option_type: ($) => prec(2, seq($._type, "?")),

    tuple_type: ($) => seq("(", optional(seq($._type, ",", commaSep($._type))), ")"),

    pointer_type: ($) => seq("*const", $._type),

    function_type: ($) =>
      seq("func", $.parameter_list, optional(seq("->", $._type))),

    // ── Statements ──────────────────────────────────────────────────────
    // NOTE: if/match live ONLY in _expression (expression_statement covers
    // their statement use) — listing them here too is an LR conflict.
    _statement: ($) =>
      choice(
        $.return_statement,
        $.declare_statement,
        $.while_loop,
        $.for_loop,
        $.break_statement,
        $.continue_statement,
        $.defer_statement,
        $.expression_statement,
        ";",
      ),

    expression_statement: ($) => $._expression,

    return_statement: ($) => prec.right(seq("return", optional($._expression))),

    break_statement: ($) => "break",
    continue_statement: ($) => "continue",
    defer_statement: ($) => prec.right(seq("defer", $._expression)),

    block: ($) => seq("{", repeat($._statement), "}"),

    if_expression: ($) =>
      prec.right(
        seq(
          "if",
          field("condition", $._expression),
          field("consequence", $.block),
          optional(seq("else", field("alternative", choice($.block, $.if_expression)))),
        ),
      ),

    if_let_expression: ($) =>
      prec.right(
        seq(
          "if",
          "let",
          field("pattern", $._match_pattern),
          "=",
          field("value", $._expression),
          field("consequence", $.block),
          optional(
            seq("else", field("alternative", choice($.block, $.if_expression))),
          ),
        ),
      ),

    while_loop: ($) => seq("while", field("condition", $._expression), field("body", $.block)),

    for_loop: ($) =>
      seq(
        "for",
        field("pattern", choice($.identifier, seq($.identifier, ",", $.identifier))),
        "in",
        field("iterator", $._expression),
        field("body", $.block),
      ),

    match_expression: ($) =>
      seq("match", field("subject", $._expression), "{", repeat($.match_arm), "}"),

    match_arm: ($) =>
      seq(field("pattern", $._match_pattern), "=>", field("value", $._expression), optional(",")),

    _match_pattern: ($) =>
      choice(
        $.variant_pattern,
        $.identifier,
        $.int_literal,
        $.float_literal,
        $.string,
        $.boolean,
        "_",
      ),

    variant_pattern: ($) =>
      seq(".", $.identifier, optional(seq("(", commaSep($.identifier), ")"))),

    // ── Expressions (precedence climbing, mirrors the lexer/ops) ────────
    _expression: ($) =>
      choice(
        $.assignment_expression,
        $.compound_assignment,
        $.elvis_expression,
        $.pipe_expression,
        $.range_expression,
        $.or_expression,
        $.and_expression,
        $.bitor_expression,
        $.bitxor_expression,
        $.bitand_expression,
        $.equality_expression,
        $.comparison_expression,
        $.shift_expression,
        $.additive_expression,
        $.multiplicative_expression,
        $.power_expression,
        $.unary_expression,
        $.try_expression,
        $.call_expression,
        $.field_expression,
        $.index_expression,
        $.closure_expression,
        $.if_expression,
        $.if_let_expression,
        $.match_expression,
        $.identifier,
        $.variant,
        $.int_literal,
        $.float_literal,
        $.boolean,
        $.string,
        $.triple_string,
        $.array_literal,
        $.dict_literal,
        $.tuple_literal,
        $.parenthesized_expression,
      ),

    assignment_expression: ($) =>
      prec.right(1, seq(field("left", $._expression), "=", field("right", $._expression))),

    compound_assignment: ($) =>
      prec.right(
        1,
        seq(
          field("left", $._expression),
          field("operator", choice("+=", "-=", "*=", "/=", "%=", "**=", "&=", "|=", "^=", "<<=", ">>=")),
          field("right", $._expression),
        ),
      ),

    // `:=` declaration
    elvis_expression: ($) => prec.right(2, seq($._expression, "??", $._expression)),
    pipe_expression: ($) => prec.left(2, seq($._expression, "|>", $._expression)),
    range_expression: ($) => prec.left(3, seq($._expression, "..", $._expression)),
    or_expression: ($) => prec.left(4, seq($._expression, "||", $._expression)),
    and_expression: ($) => prec.left(5, seq($._expression, "&&", $._expression)),
    bitor_expression: ($) => prec.left(6, seq($._expression, "|", $._expression)),
    bitxor_expression: ($) => prec.left(7, seq($._expression, "^", $._expression)),
    bitand_expression: ($) => prec.left(8, seq($._expression, "&", $._expression)),
    equality_expression: ($) =>
      prec.left(9, seq($._expression, choice("==", "!="), $._expression)),
    comparison_expression: ($) =>
      prec.left(10, seq($._expression, choice("<", ">", "<=", ">="), $._expression)),
    shift_expression: ($) =>
      prec.left(11, seq($._expression, choice("<<", ">>"), $._expression)),
    additive_expression: ($) =>
      prec.left(12, seq($._expression, choice("+", "-"), $._expression)),
    multiplicative_expression: ($) =>
      prec.left(13, seq($._expression, choice("*", "/", "%"), $._expression)),
    power_expression: ($) => prec.right(14, seq($._expression, "**", $._expression)),

    unary_expression: ($) =>
      prec(
        15,
        seq(field("operator", choice("-", "!", "~")), field("operand", $._expression)),
      ),

    try_expression: ($) => prec(16, seq($._expression, "?")),

    call_expression: ($) =>
      prec(
        14,
        seq(
          field("function", $._expression),
          "(",
          optional(commaSep($._expression)),
          ")",
        ),
      ),

    field_expression: ($) =>
      prec(14, seq(field("object", $._expression), ".", field("field", $.identifier))),

    index_expression: ($) =>
      prec(14, seq(field("object", $._expression), "[", field("index", $._expression), "]")),

    closure_expression: ($) =>
      prec.right(seq("|", optional(commaSep($.parameter)), "|", $._expression)),

    declare_statement: ($) =>
      seq(field("name", $.identifier), ":=", field("value", $._expression)),

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    array_literal: ($) => seq("[", optional(commaSep($._expression)), "]"),

    dict_literal: ($) =>
      seq("{", optional(commaSep($.dict_entry)), "}"),

    dict_entry: ($) => seq(field("key", $._expression), ":", field("value", $._expression)),

    tuple_literal: ($) => seq("(", $._expression, ",", commaSep($._expression), ")"),

    // `.name` is ONE token shape (see variant below): field access and
    // leading variants disambiguate by position, never by lexing.
    variant: ($) => seq(".", $.identifier),

    identifier: (_) => /[a-z_][A-Za-z0-9_]*/,

    boolean: (_) => choice("true", "false"),

    int_literal: (_) => /[0-9][0-9_]*/,
    float_literal: (_) => /[0-9][0-9_]*\.[0-9][0-9_]*/,

    // ── Strings ─────────────────────────────────────────────────────────
    // `{expr}` interpolates; `{{` / `}}` are literal-brace escapes.
    // Lone braces fall back to brace_content / rbrace so nothing valid
    // ever ERRORs (`"{"` at end-of-string is the one known gap: the
    // documented escapes are `\{` and `{{`, so bare `{` there is user
    // error in real code too). Single-line complement [^A-Za-z_"] also
    // serves triple strings (`{1}`, `{(a)}` still interpolate: the
    // digit/paren is simply not in the complement).
    string: ($) =>
      seq(
        '"',
        repeat(
          choice(
            $.string_content,
            $.brace_content,
            $.rbrace,
            $.escape_sequence,
            $.interpolation,
          ),
        ),
        token.immediate('"'),
      ),

    triple_string: ($) =>
      seq(
        '"""',
        repeat(
          choice(
            $.string_content,
            $.brace_content,
            $.rbrace,
            $.escape_sequence,
            $.interpolation,
          ),
        ),
        '"""',
      ),

    string_content: (_) => /[^{"\\}]+/,

    // `{` + non-interp char (2 chars — beats interpolation's 1-char
    // opener by length; loses `{{` ties to escape via precedence).
    brace_content: (_) => /\{[^A-Za-z_"]/,

    // Lone `}` (2-char `}}` escape wins by length where doubled).
    rbrace: (_) => "}",

    // `{expr}` — dynamic precedence prefers interpolation when a full
    // `... }` parse succeeds; lone braces fall back to string_content's
    // sibling token below.
    interpolation: ($) => prec.dynamic(1, seq("{", $._expression, "}")),

    // `{expr}` interpolates; `{{` / `}}` are literal-brace escapes
    // (prec 1 wins `{{` ties against brace_content).
    escape_sequence: (_) =>
      token(prec(1, choice(/\\[ntr\\"{}e]/, /\\x[0-9a-fA-F]{2}/, "{{", "}}"))),

    // ── Comments (nestable block) ───────────────────────────────────────
    line_comment: (_) => token(seq("//", /[^\n]*/)),
    // Nested: `/` and `*` lex separately, so a nested `/*` opener
    // (2 chars) always beats a lone `/` (1 char) and recursion wins.
    // Trailing `\*+` + `/` closes runs like `/***/`.
    block_comment: ($) =>
      seq(
        "/*",
        repeat(choice(/[^*/]+/, /\//, /\*+[^/*]/, prec.dynamic(1, $.block_comment))),
        /\*+/,
        "/",
      ),
  },
});

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)), optional(","));
}
