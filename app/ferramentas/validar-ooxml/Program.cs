// Valida um DOCX contra o esquema OOXML (M3-T07; ADR-0006, camada 6; R47). Não altera o arquivo.
// Uso: dotnet ValidarOoxml.dll arquivo.docx. Saída: JSON com os erros. Código 0 = válido; 1 = com erros; 2 = não abriu.
using System.Text.Encodings.Web;
using System.Text.Json;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Validation;

var opcoesJson = new JsonSerializerOptions { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
if (args.Length != 1)
{
    Console.Error.WriteLine("uso: ValidarOoxml arquivo.docx");
    return 2;
}
try
{
    using var doc = WordprocessingDocument.Open(args[0], false);
    var validador = new OpenXmlValidator(FileFormatVersions.Office2021);
    var erros = validador.Validate(doc)
        .Select(e => new { tipo = e.ErrorType.ToString(), id = e.Id, descricao = e.Description, parte = e.Part?.Uri.ToString(), caminho = e.Path?.XPath })
        .ToList();
    Console.WriteLine(JsonSerializer.Serialize(new { abriu = true, erros }, opcoesJson));
    return erros.Count == 0 ? 0 : 1;
}
catch (Exception e)
{
    Console.WriteLine(JsonSerializer.Serialize(new { abriu = false, erro = e.GetType().Name }, opcoesJson));
    return 2;
}
