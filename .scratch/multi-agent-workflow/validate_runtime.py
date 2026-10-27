"""Read effective project configuration and skill discovery without starting a model turn."""

import argparse
import json
import pathlib
import queue
import shutil
import subprocess
import tempfile
import threading

root = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--check-global-skills", nargs="*", default=[])
arguments = parser.parse_args()
responses = queue.Queue()
with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as errors:
    process = subprocess.Popen(
        [shutil.which("codex"), "app-server", "--strict-config", "--stdio"],
        cwd=root, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors,
        text=True, encoding="utf-8",
    )

    def read_output():
        for line in process.stdout:
            try:
                responses.put(json.loads(line))
            except json.JSONDecodeError:
                pass

    threading.Thread(target=read_output, daemon=True).start()

    def send(message):
        process.stdin.write(json.dumps(message) + "\n")
        process.stdin.flush()

    def request(identifier, method, params):
        send({"id": identifier, "method": method, "params": params})
        while True:
            response = responses.get(timeout=25)
            if response.get("id") == identifier:
                if "error" in response:
                    raise RuntimeError(response["error"])
                return response["result"]

    try:
        request(1, "initialize", {"clientInfo": {"name": "workflow-validation", "version": "1.0"}, "capabilities": {"experimentalApi": True}})
        send({"method": "initialized"})
        configuration = request(2, "config/read", {"cwd": str(root), "includeLayers": True})
        config = configuration["config"]
        print(json.dumps({"model": config.get("model"), "reasoning": config.get("model_reasoning_effort"), "agents": config.get("agents")}, indent=2))
        print("Project layer:", any(".codex" in json.dumps(layer) and str(root).replace("\\", "/").lower() in json.dumps(layer).replace("\\\\", "/").lower() for layer in configuration.get("layers", [])))
        skills = request(3, "skills/list", {"cwds": [str(root)], "forceReload": True})
        found = [skill for entry in skills.get("data", []) for skill in entry.get("skills", []) if skill.get("name") == "project-development"]
        print("Project skill:", json.dumps(found, indent=2))
        assert config["model"] == "gpt-6.1-sol"
        assert config["model_reasoning_effort"] == "high"
        assert config["agents"]["max_concurrent_threads_per_session"] == 6
        assert found, "Project skill was not discovered"
        discovered = {skill["name"]: skill for entry in skills.get("data", []) for skill in entry.get("skills", [])}
        for name in arguments.check_global_skills:
            assert name in discovered and discovered[name].get("enabled"), name
            print("Global skill:", name, discovered[name]["path"])
    finally:
        process.terminate()
        process.wait(timeout=10)
