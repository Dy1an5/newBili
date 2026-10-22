#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

for tool in systemd-run taskset; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        printf '缺少 %s, 无法保证构建资源限制.\n' "$tool" >&2
        exit 1
    fi
done

if [[ ! -x "$project_dir/android/gradlew" ]]; then
    printf '缺少 android/gradlew, 请先同步原生工程.\n' >&2
    exit 1
fi

# Ninja 不受 Gradle workers 限制, 通过 CPU 亲和性限制其默认并发.
allowed_cpus="$(taskset -pc "$$")"
allowed_cpus="${allowed_cpus##*: }"
first_cpu="${allowed_cpus%%[,-]*}"

if [[ $# -eq 0 ]]; then
    set -- :app:assembleDebug
fi

printf '构建限制: 内存上限 6GiB, CPU %s, Gradle worker 1, ABI arm64-v8a.\n' "$first_cpu"

exec systemd-run --user --scope --quiet \
    --unit=myfollow-android-build \
    --property=MemoryHigh=5G \
    --property=MemoryMax=6G \
    --property=MemorySwapMax=0 \
    taskset --cpu-list "$first_cpu" \
    env CMAKE_BUILD_PARALLEL_LEVEL=2 \
    "$project_dir/android/gradlew" -p "$project_dir/android" \
    --no-daemon --no-parallel --max-workers=1 \
    '-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m -XX:ActiveProcessorCount=2' \
    -Pkotlin.compiler.execution.strategy=in-process \
    -PreactNativeArchitectures=arm64-v8a \
    "$@"
