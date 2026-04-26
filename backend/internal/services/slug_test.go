package services

import "testing"

func TestSlugifyAndIdentifier(t *testing.T) {
	if got := Slugify(" API Production! "); got != "api-production" {
		t.Fatalf("Slugify() = %q", got)
	}
	if got := Identifier("123 API"); got != "r_123_api" {
		t.Fatalf("Identifier() = %q", got)
	}
	if got := ShortID("12345678-aaaa-bbbb"); got != "12345678" {
		t.Fatalf("ShortID() = %q", got)
	}
}
