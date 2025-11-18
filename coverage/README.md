# Coverage Setup Plan

## Goals
- Enable code coverage for Pest/PhpUnit using Xdebug or PCOV.
- Enforce minimum global coverage threshold (e.g. 60%) in CI.
- Report HTML + Clover/XML outputs for integration (GitHub Actions artifact + PR comment bots).

## Local Run
```bash
php -d xdebug.mode=coverage vendor/bin/pest --coverage --min=60
```
If using PCOV:
```bash
php -d pcov.enabled=1 vendor/bin/pest --coverage --min=60
```

## PhpUnit XML (ensure this snippet inside <phpunit>):
```xml
<coverage processUncoveredFiles="true">
  <include>
    <directory suffix=".php">app</directory>
  </include>
  <report>
    <clover outputFile="coverage/clover.xml"/>
    <html outputDirectory="coverage/html"/>
    <text outputFile="coverage/summary.txt"/>
  </report>
</coverage>
```

## GitHub Actions (example step)
```yaml
- name: Run tests with coverage
  run: php -d xdebug.mode=coverage vendor/bin/pest --coverage --min=60
- name: Upload coverage artifact
  uses: actions/upload-artifact@v4
  with:
    name: coverage-html
    path: coverage/html
```

## Next Improvements
- Add per-directory thresholds (e.g. Models 70%, Services 65%).
- Integrate mutation testing (Infection) once baseline stabilized.
- Fail PR if coverage drops >2% below main branch.
