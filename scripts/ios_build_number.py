#!/usr/bin/env python3
"""Use Codemagic's project counter across candidate and upload workflows."""

import os
import re


def ios_build_number(environment=None):
    environment = os.environ if environment is None else environment
    value = environment.get("PROJECT_BUILD_NUMBER", "")
    if not isinstance(value, str) or re.fullmatch(r"[1-9][0-9]*", value) is None:
        raise ValueError("PROJECT_BUILD_NUMBER must be a positive app-wide Codemagic build number.")
    return value


def verify_ios_build_number(exported_number, environment=None):
    expected = ios_build_number(environment)
    if exported_number != expected:
        raise ValueError("The exported IPA build number does not match app-wide PROJECT_BUILD_NUMBER.")
    return expected


if __name__ == "__main__":
    print(ios_build_number())
