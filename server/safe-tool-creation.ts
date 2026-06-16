/**
 * Safe Tool Creation - Validates tool specifications and generated code.
 * Phase F: Prevents unsafe tools from being created.
 * Checks for: eval, exec, shell commands, unsafe file operations, secret exposure.
 */

export interface ToolSpecification {
  name: string;
  description: string;
  inputs: Record<string, { type: string; description: string }>;
  outputs: Record<string, { type: string; description: string }>;
  requiredCapabilities: string[];
  expectedBehavior: string;
}

export interface SecurityValidationResult {
  safe: boolean;
  violations: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * Dangerous patterns that should never appear in tool code.
 */
const DANGEROUS_PATTERNS = [
  /\beval\s*\(/i,
  /\bFunction\s*\(/i,
  /\bexec\s*\(/i,
  /\bexecSync\s*\(/i,
  /\bspawnSync\s*\(/i,
  /\bspawn\s*\(/i,
  /\brequire\s*\(\s*['"`]child_process/i,
  /\bfs\.writeFile/i,
  /\bfs\.writeFileSync/i,
  /\bfs\.unlink/i,
  /\bfs\.rmdir/i,
  /\bfs\.rm\s*\(/i,
  /\bprocess\.env\./i,
  /\bprocess\.exit/i,
  /\bprocess\.kill/i,
  /\bsql\s*\(\s*`/i, // Raw SQL with template literals
  /\bexecute\s*\(\s*`/i,
  /\bquery\s*\(\s*`/i,
];

/**
 * Patterns that suggest unsafe behavior but might be legitimate.
 */
const WARNING_PATTERNS = [
  { pattern: /\bsqlite3/i, message: 'Direct database driver usage - prefer ORM' },
  { pattern: /\bMySQL/i, message: 'Direct database driver usage - prefer ORM' },
  { pattern: /\bPostgres/i, message: 'Direct database driver usage - prefer ORM' },
  { pattern: /\bHTTP\s*\(/i, message: 'HTTP client usage - verify SSL/TLS' },
  { pattern: /\bfetch\s*\(/i, message: 'External API call - verify endpoint' },
  { pattern: /\baxios\s*\./i, message: 'External API call - verify endpoint' },
];

/**
 * Validate tool code for security issues.
 */
export function validateToolCode(code: string): SecurityValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      violations.push(`Dangerous pattern detected: ${pattern.source}`);
    }
  }

  // Check for warning patterns
  for (const { pattern, message } of WARNING_PATTERNS) {
    if (pattern.test(code)) {
      warnings.push(message);
    }
  }

  // Check for hardcoded secrets
  if (/['"`](sk_|api_key|secret|password|token)\w+['"`]/i.test(code)) {
    violations.push('Hardcoded secret detected in code');
  }

  // Check for unsafe string concatenation in SQL
  if (/sql\s*\(\s*['"`].*\$\{.*\}.*['"`]/i.test(code)) {
    violations.push('SQL injection risk: string concatenation in SQL query');
  }

  // Recommendations based on violations
  if (violations.length === 0 && warnings.length === 0) {
    recommendations.push('Code appears safe for execution');
  } else if (violations.length === 0) {
    recommendations.push('Address warnings before production deployment');
  } else {
    recommendations.push('Rewrite tool to eliminate all violations');
    recommendations.push('Use parameterized queries for database operations');
    recommendations.push('Use environment variables for configuration');
  }

  return {
    safe: violations.length === 0,
    violations,
    warnings,
    recommendations,
  };
}

/**
 * Validate a tool specification before code generation.
 */
export function validateToolSpecification(spec: ToolSpecification): SecurityValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Validate name
  if (!spec.name || spec.name.length === 0) {
    violations.push('Tool name is required');
  }

  if (!/^[a-z_][a-z0-9_]*$/.test(spec.name)) {
    violations.push('Tool name must be lowercase with underscores only');
  }

  // Validate inputs/outputs
  if (!spec.inputs || Object.keys(spec.inputs).length === 0) {
    warnings.push('Tool has no inputs - verify this is intentional');
  }

  if (!spec.outputs || Object.keys(spec.outputs).length === 0) {
    violations.push('Tool must have at least one output');
  }

  // Validate expected behavior
  if (!spec.expectedBehavior || spec.expectedBehavior.length < 10) {
    violations.push('Expected behavior description is too short');
  }

  // Check for suspicious keywords in description
  if (/(delete|drop|destroy|remove|unlink|rm\s|chmod|chown)/i.test(spec.description)) {
    warnings.push('Tool description contains destructive keywords - verify safety');
  }

  // Recommendations
  if (violations.length === 0) {
    recommendations.push('Specification is valid');
    if (warnings.length > 0) {
      recommendations.push('Review warnings before proceeding');
    }
  } else {
    recommendations.push('Fix all violations before code generation');
  }

  return {
    safe: violations.length === 0,
    violations,
    warnings,
    recommendations,
  };
}

/**
 * Generate a security report for a tool.
 */
export function generateSecurityReport(
  spec: ToolSpecification,
  code: string
): { specValidation: SecurityValidationResult; codeValidation: SecurityValidationResult; overallSafe: boolean } {
  const specValidation = validateToolSpecification(spec);
  const codeValidation = validateToolCode(code);

  return {
    specValidation,
    codeValidation,
    overallSafe: specValidation.safe && codeValidation.safe,
  };
}

/**
 * Get human-readable security report.
 */
export function formatSecurityReport(report: ReturnType<typeof generateSecurityReport>): string {
  const lines: string[] = [];

  lines.push('=== SECURITY VALIDATION REPORT ===\n');

  if (report.overallSafe) {
    lines.push('✅ SAFE: Tool passed all security checks\n');
  } else {
    lines.push('❌ UNSAFE: Tool has security violations\n');
  }

  if (report.specValidation.violations.length > 0) {
    lines.push('Specification Violations:');
    report.specValidation.violations.forEach((v) => lines.push(`  - ${v}`));
    lines.push('');
  }

  if (report.codeValidation.violations.length > 0) {
    lines.push('Code Violations:');
    report.codeValidation.violations.forEach((v) => lines.push(`  - ${v}`));
    lines.push('');
  }

  if (report.specValidation.warnings.length > 0 || report.codeValidation.warnings.length > 0) {
    lines.push('Warnings:');
    [...report.specValidation.warnings, ...report.codeValidation.warnings].forEach((w) => lines.push(`  ⚠️  ${w}`));
    lines.push('');
  }

  if (report.specValidation.recommendations.length > 0 || report.codeValidation.recommendations.length > 0) {
    lines.push('Recommendations:');
    [...report.specValidation.recommendations, ...report.codeValidation.recommendations].forEach((r) =>
      lines.push(`  • ${r}`)
    );
  }

  return lines.join('\n');
}
