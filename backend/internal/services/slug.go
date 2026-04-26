package services

import (
	"regexp"
	"strings"
	"unicode"
)

var slugSeparatorRe = regexp.MustCompile(`[-_]+`)

func Slugify(input string) string {
	input = strings.TrimSpace(strings.ToLower(input))
	var b strings.Builder
	lastDash := false
	for _, r := range input {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastDash = false
		case unicode.IsLetter(r), unicode.IsDigit(r):
			b.WriteRune(r)
			lastDash = false
		default:
			if !lastDash {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}
	out := strings.Trim(slugSeparatorRe.ReplaceAllString(b.String(), "-"), "-")
	if out == "" {
		return "item"
	}
	return out
}

func ShortID(id string) string {
	id = strings.ReplaceAll(strings.TrimSpace(id), "-", "")
	if len(id) >= 8 {
		return id[:8]
	}
	if id == "" {
		return "00000000"
	}
	return id
}

func Identifier(input string) string {
	slug := Slugify(input)
	slug = strings.ReplaceAll(slug, "-", "_")
	if slug == "" {
		return "item"
	}
	if slug[0] >= '0' && slug[0] <= '9' {
		return "r_" + slug
	}
	return slug
}
