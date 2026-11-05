import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { RAIL_MIN_WIDTH_DP, resolveShellNavigation } from "../src/layout/resolveShellNavigation.ts";
import { isHeadsetDevice, resolveShellPlatform } from "../src/layout/resolveShellPlatform.ts";

const PLACEMENTS = ["inline", "pending", "spatial", "dropped"];
const WIDTHS = [0, 320, 412, RAIL_MIN_WIDTH_DP - 1, RAIL_MIN_WIDTH_DP, 1280, 4096];

describe("resolveShellNavigation", () => {
  test("a headset never gets bottom tabs, whatever the rail window or width", () => {
    for (const railWindow of PLACEMENTS) {
      for (const widthDp of WIDTHS) {
        assert.notEqual(resolveShellNavigation({ isHeadset: true, railWindow, widthDp }), "bottom-tabs");
      }
    }
  });

  test("a headset gets the rail window only once Meta or the PICO strip placed it", () => {
    assert.equal(resolveShellNavigation({ isHeadset: true, railWindow: "spatial", widthDp: 1280 }), "rail-window");
    for (const railWindow of ["inline", "pending", "dropped"]) {
      assert.equal(resolveShellNavigation({ isHeadset: true, railWindow, widthDp: 1280 }), "rail-inline");
    }
  });

  test("a phone gets bottom tabs below 600dp", () => {
    for (const widthDp of [320, 360, 412, 599]) {
      assert.equal(resolveShellNavigation({ isHeadset: false, railWindow: "inline", widthDp }), "bottom-tabs");
    }
  });

  test("tablets and unfolded foldables get the in-window rail from 600dp", () => {
    for (const widthDp of [600, 840, 1280]) {
      assert.equal(resolveShellNavigation({ isHeadset: false, railWindow: "inline", widthDp }), "rail-inline");
    }
  });

  test("a stray spatial placement off a headset does not open a rail window", () => {
    assert.equal(resolveShellNavigation({ isHeadset: false, railWindow: "spatial", widthDp: 412 }), "bottom-tabs");
  });
});

describe("resolveShellPlatform", () => {
  const PHONE = { Manufacturer: "Google", Brand: "google", Model: "Pixel 9" };

  test("the quest flavor uses the Meta Layout SDK", () => {
    assert.deepEqual(
      resolveShellPlatform({ isHorizonBuild: true, isPicoBuild: false, os: "android", deviceConstants: PHONE }),
      { isHeadset: true, windowBackend: "meta-horizon-layout" }
    );
  });

  test("the pico flavor uses the main window's strip", () => {
    assert.deepEqual(
      resolveShellPlatform({ isHorizonBuild: false, isPicoBuild: true, os: "android", deviceConstants: PHONE }),
      { isHeadset: true, windowBackend: "pico-spatial" }
    );
  });

  test("a headset running a phone variant still counts as a headset", () => {
    const quest3s = { Manufacturer: "Oculus", Brand: "oculus", Model: "Quest 3S" };
    assert.deepEqual(
      resolveShellPlatform({ isHorizonBuild: false, isPicoBuild: false, os: "android", deviceConstants: quest3s }),
      { isHeadset: true, windowBackend: "none" }
    );
  });

  test("a phone is not a headset", () => {
    assert.deepEqual(
      resolveShellPlatform({ isHorizonBuild: false, isPicoBuild: false, os: "android", deviceConstants: PHONE }),
      { isHeadset: false, windowBackend: "none" }
    );
    assert.deepEqual(resolveShellPlatform({ isHorizonBuild: false, isPicoBuild: false, os: "ios" }), {
      isHeadset: false,
      windowBackend: "none",
    });
  });
});

describe("isHeadsetDevice", () => {
  test("recognises Quest, Meta and PICO hardware", () => {
    assert.equal(isHeadsetDevice("android", { Manufacturer: "Oculus", Brand: "oculus", Model: "Quest 3S" }), true);
    assert.equal(isHeadsetDevice("android", { Manufacturer: "Meta", Brand: "meta", Model: "Quest 3" }), true);
    assert.equal(isHeadsetDevice("android", { Manufacturer: "Pico", Brand: "Pico", Model: "A9210" }), true);
    assert.equal(isHeadsetDevice("android", { Manufacturer: "ByteDance", Brand: "x", Model: "y" }), true);
    assert.equal(isHeadsetDevice("android", { Manufacturer: "x", Brand: "y", Model: "Quest Pro" }), true);
  });

  test("rejects phones, other platforms and missing constants", () => {
    assert.equal(isHeadsetDevice("android", { Manufacturer: "samsung", Brand: "samsung", Model: "SM-S928B" }), false);
    assert.equal(isHeadsetDevice("android", { Model: "Questionnaire" }), false);
    assert.equal(isHeadsetDevice("ios", { Manufacturer: "Oculus" }), false);
    assert.equal(isHeadsetDevice("android", undefined), false);
  });
});
